/**
 * POST  /admin/api/studio/projects/[id]/image  — generate AI image OR save uploaded image
 * GET   /admin/api/studio/projects/[id]/image  — list images for project
 * PATCH /admin/api/studio/projects/[id]/image  — approve / reject / set as cover
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { verifyLegacyImageFormat } from '@/lib/studio/image-media';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioImages } = await import('@/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const images = await db.select().from(studioImages)
    .where(eq(studioImages.projectId, id))
    .orderBy(desc(studioImages.createdAt));

  return NextResponse.json({ images });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  let body: { action?: string; url?: string; altText?: string; objectPath?: string } = {};
  try { body = await req.json() as typeof body; }
  catch { /* no body for generate */ }

  const { db } = await import('@/db');
  const { studioProjects, studioImages, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  // If body has url — this is an upload (no AI generation)
  if (body.url) {
    const [img] = await db.insert(studioImages).values({
      projectId:   id,
      url:         body.url,
      objectPath:  body.objectPath ?? null,
      altText:     body.altText ?? null,
      usageRights: 'admin_uploaded',
      status:      'pending_approval',
      createdAt:   new Date(),
    }).returning();

    await db.update(studioProjects).set({ stage: 'visual', updatedAt: new Date() }).where(eq(studioProjects.id, id));
    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'image_uploaded', detail: { url: body.url }, createdAt: new Date(),
    });

    return NextResponse.json({ image: img }, { status: 201 });
  }

  // AI generation
  const trContent = project.trContent as { title?: string; excerpt?: string } | null;
  const config    = project.config    as { cityOrRoute?: string; serviceType?: string } | null;

  const { generateStudioImage } = await import('@/lib/studio/ai-studio');
  const result = await generateStudioImage({
    title:       trContent?.title ?? project.titleWorking ?? 'VIP Transfer',
    excerpt:     trContent?.excerpt ?? '',
    cityOrRoute: config?.cityOrRoute,
    serviceType: config?.serviceType,
  });

  if (!result.ok) {
    // Image generation not available — return graceful error, UI should show upload fallback
    return NextResponse.json({
      error:    result.message,
      fallback: true,   // signal UI to show manual upload instead
    }, { status: result.reason === 'not_configured' ? 503 : 500 });
  }

  // Download the provider image server-side and upload verified bytes via sidecar.
  const SIDECAR = 'http://127.0.0.1:1106';
  const privateDir = process.env.PRIVATE_OBJECT_DIR ?? '';
  let imageUrl: string | null = null;
  let objectPath: string | null = null;

  // Save the temporary OpenAI CDN URL for immediate use
  const tempUrl = result.data.imageUrl; // expires ~1 h

  if (privateDir) {
    try {
      const cleaned    = privateDir.replace(/^gs:\/\//, '');
      const slash      = cleaned.indexOf('/');
      const bucketName = slash === -1 ? cleaned : cleaned.slice(0, slash);
      const prefix     = slash === -1 ? '' : cleaned.slice(slash + 1);
      // Download first so the persisted extension and Content-Type match the
      // verified provider bytes. DALL-E URL responses are normally PNG.
      const imgFetch = await fetch(tempUrl, { signal: AbortSignal.timeout(30_000) });
      if (imgFetch.ok) {
        const imgBytes = new Uint8Array(await imgFetch.arrayBuffer());
        const format = imgBytes.length <= 10 * 1024 * 1024
          ? verifyLegacyImageFormat(imgFetch.headers.get('content-type'), imgBytes)
          : null;
        if (!format) throw new Error('Unsupported legacy image format');
        const entityId = `studio/${id}/${Date.now()}.${format.extension}`;
        const objectName = [prefix, entityId].filter(Boolean).join('/');
        const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket_name: bucketName, object_name: objectName,
            method: 'PUT', expires_at: new Date(Date.now() + 900_000).toISOString(),
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!signRes.ok) throw new Error('Storage signing failed');
        const { signed_url } = await signRes.json() as { signed_url: string };
        const putRes = await fetch(signed_url, {
          method: 'PUT',
          body: imgBytes,
          headers: { 'Content-Type': format.contentType },
        });
        if (putRes.ok) {
          objectPath = entityId;
          imageUrl   = `/api/storage/objects/${entityId}`;
        } else throw new Error('Storage upload failed');
      } else throw new Error('Provider image download failed');
    } catch {
      // Do not log signed/provider URLs or potentially credential-bearing errors.
      console.error('[studio/image] upload failed — using temporary image URL');
      imageUrl = tempUrl; // fall back to temporary CDN URL
    }
  } else {
    // No storage configured — use the temp URL with a TTL warning
    imageUrl = tempUrl;
    console.warn('[studio/image] PRIVATE_OBJECT_DIR not set — storing temporary OpenAI CDN URL (~1h TTL)');
  }

  // Save image record
  const [img] = await db.insert(studioImages).values({
    projectId:   id,
    url:         imageUrl,
    objectPath:  objectPath,
    prompt:      result.data.prompt,
    altText:     result.data.altText,
    usageRights: result.data.usageRights,
    status:      'pending_approval',
    createdAt:   new Date(),
  }).returning();

  await db.update(studioProjects).set({ stage: 'visual', updatedAt: new Date() }).where(eq(studioProjects.id, id));
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'image_generated',
    detail: { model: result.model, uploaded: !!imageUrl },
    createdAt: new Date(),
  });

  return NextResponse.json({ image: img, warning: result.data.warning }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json() as { imageId?: string; action?: 'approve' | 'reject'; rejectionReason?: string; altText?: string };

  if (!body.imageId || !body.action) {
    return NextResponse.json({ error: 'imageId ve action gerekli.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { studioImages, studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const now = new Date();

  if (body.action === 'approve') {
    const [img] = await db.update(studioImages)
      .set({ status: 'approved', approvedAt: now, approvedBy: admin?.id ?? null, altText: body.altText ?? null })
      .where(and(eq(studioImages.id, body.imageId), eq(studioImages.projectId, id)))
      .returning();
    if (!img) return NextResponse.json({ error: 'Görsel bulunamadı.' }, { status: 404 });

    // Set as cover on project
    await db.update(studioProjects).set({
      coverImageUrl: img.url,
      coverImageAlt: img.altText,
      stage:         'visual',
      updatedAt:     now,
    }).where(eq(studioProjects.id, id));

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'image_approved', detail: { imageId: body.imageId }, createdAt: now,
    });
    return NextResponse.json({ image: img });
  }

  if (body.action === 'reject') {
    const [img] = await db.update(studioImages)
      .set({ status: 'rejected', rejectionReason: body.rejectionReason ?? null })
      .where(and(eq(studioImages.id, body.imageId), eq(studioImages.projectId, id)))
      .returning();
    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'image_rejected', detail: { imageId: body.imageId, reason: body.rejectionReason }, createdAt: now,
    });
    return NextResponse.json({ image: img });
  }

  return NextResponse.json({ error: 'Geçersiz action.' }, { status: 400 });
}
