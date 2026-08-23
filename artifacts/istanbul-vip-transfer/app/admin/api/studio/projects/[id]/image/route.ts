/**
 * POST  /admin/api/studio/projects/[id]/image  — retired (use /admin/ai-studio/gorsel-uret)
 * GET   /admin/api/studio/projects/[id]/image  — list images for project
 * PATCH /admin/api/studio/projects/[id]/image  — approve / reject / set as cover
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  await params; // Preserve the route signature while intentionally not touching project data.
  return NextResponse.json({
    error: 'Bu eski proje görseli uç noktası kaldırıldı. Kalıcı GPT Image 2 görselleri için /admin/ai-studio/gorsel-uret sayfasını kullanın.',
    redirectTo: '/admin/ai-studio/gorsel-uret',
  }, { status: 410 });
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
