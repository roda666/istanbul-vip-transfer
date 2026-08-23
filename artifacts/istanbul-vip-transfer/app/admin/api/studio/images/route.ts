/**
 * Admin-only bridge for generating and attaching permanent AI images.
 * Provider URLs and responses never leave this route; only our stable storage
 * URL is persisted in CMS content.
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { localizedServicePath, localizedStaticPath } from '@/lib/localized-service-path';
import { appendServiceInlineImage, parseServicePageBody } from '@/lib/service-page-types';

export const dynamic = 'force-dynamic';

const targetSchema = z.enum(['BLOG_POST', 'SERVICE']);
const generateSchema = z.object({
  action: z.literal('generate'),
  target: targetSchema,
  id: z.string().uuid(),
  prompt: z.string().trim().min(10).max(4_000),
  altText: z.string().trim().min(5).max(300),
});
const attachSchema = z.object({
  action: z.literal('attach'),
  target: targetSchema,
  id: z.string().uuid(),
  imagePath: z.string().regex(/^\/api\/storage\/objects\/ai-images\/(blog|service)\/[a-z0-9-]+\/[0-9a-f-]{36}\.webp$/),
  altText: z.string().trim().min(5).max(300),
  placement: z.enum(['hero', 'body']),
});

function targetFolder(target: z.infer<typeof targetSchema>) {
  return target === 'BLOG_POST' ? 'blog' : 'service';
}

async function findTarget(id: string, target: z.infer<typeof targetSchema>) {
  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await db.select().from(content)
    .where(and(eq(content.id, id), eq(content.contentType, target))).limit(1);
  return row ?? null;
}

/** Invalidate detail, localized detail, listing and metadata routes after DB commit. */
async function revalidateAttachedContent(target: {
  id: string;
  slug: string;
  contentType: 'BLOG_POST' | 'SERVICE';
}) {
  if (target.contentType === 'BLOG_POST') {
    revalidatePath(`/blog/${target.slug}`);
    revalidatePath('/blog');
    const { db } = await import('@/db');
    const { contentTranslations } = await import('@/db/schema');
    const { and, eq } = await import('drizzle-orm');
    const translations = await db.select({
      locale: contentTranslations.targetLanguageCode,
      slug: contentTranslations.slug,
    }).from(contentTranslations).where(and(
      eq(contentTranslations.entityType, 'content'),
      eq(contentTranslations.entityId, target.id),
    ));
    for (const translation of translations) {
      if (translation.locale !== 'tr' && translation.slug) {
        revalidatePath(`/${translation.locale}/blog/${translation.slug}`);
        revalidatePath(`/${translation.locale}/blog`);
      }
    }
  } else {
    revalidatePath(localizedServicePath(target.slug, 'tr'));
    revalidatePath(localizedStaticPath('hizmetler', 'tr'));
    for (const locale of SUPPORTED_LANGS) {
      revalidatePath(localizedServicePath(target.slug, locale));
      revalidatePath(localizedStaticPath('hizmetler', locale));
    }
  }
  revalidatePath('/sitemap.xml');
}

function parsePrivateObjectDir(dir: string) {
  const cleaned = dir.replace(/^gs:\/\//, '');
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function putPrivateWebp(entityId: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; message: string }> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) return { ok: false, message: 'Görsel depolama hizmeti yapılandırılmamış.' };
  const { bucket, prefix } = parsePrivateObjectDir(privateDir);
  if (!bucket) return { ok: false, message: 'Görsel depolama yapılandırması geçersiz.' };
  try {
    const sign = await fetch(`${process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106'}/object-storage/signed-object-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket_name: bucket,
        object_name: [prefix, entityId].filter(Boolean).join('/'),
        method: 'PUT',
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!sign.ok) return { ok: false, message: 'Görsel depolama imzası alınamadı.' };
    const signed = await sign.json() as { signed_url?: unknown };
    if (typeof signed.signed_url !== 'string') return { ok: false, message: 'Görsel depolama imzası geçersiz.' };
    const upload = await fetch(signed.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
      body: bytes,
      signal: AbortSignal.timeout(60_000),
    });
    return upload.ok ? { ok: true } : { ok: false, message: 'Görsel depolamaya kaydedilemedi.' };
  } catch {
    // Never log signed URLs or provider data.
    return { ok: false, message: 'Görsel depolama hizmetine ulaşılamadı.' };
  }
}

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const target = targetSchema.safeParse(req.nextUrl.searchParams.get('target'));
  if (!target.success) return NextResponse.json({ error: 'target BLOG_POST veya SERVICE olmalıdır.' }, { status: 400 });
  try {
    const { db } = await import('@/db');
    const { content } = await import('@/db/schema');
    const { asc, eq } = await import('drizzle-orm');
    const targets = await db.select({
      id: content.id, title: content.title, slug: content.slug,
      heroImage: content.heroImage, heroImageAlt: content.heroImageAlt,
    }).from(content).where(eq(content.contentType, target.data)).orderBy(asc(content.title)).limit(200);
    return NextResponse.json({ targets });
  } catch {
    return NextResponse.json({ error: 'Hedef içerikler alınamadı.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try { session = await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const isGenerate = typeof raw === 'object' && raw !== null && (raw as { action?: unknown }).action === 'generate';
  const parsed = (isGenerate ? generateSchema : attachSchema).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz görsel isteği.' }, { status: 400 });
  const data = parsed.data;
  const target = await findTarget(data.id, data.target);
  if (!target) return NextResponse.json({ error: 'Hedef içerik bulunamadı.' }, { status: 404 });

  if (data.action === 'generate') {
    const { generateImageAsset } = await import('@/lib/studio/ai-studio');
    const result = await generateImageAsset({ prompt: data.prompt, altText: data.altText });
    if (!result.ok) {
      const status = result.reason === 'not_configured'
        ? 503
        : result.reason === 'credit_exhausted'
          ? 402
          : result.reason === 'rate_limited'
            ? 429
            : 502;
      return NextResponse.json({ error: result.message }, { status });
    }
    const entityId = `ai-images/${targetFolder(data.target)}/${target.slug}/${crypto.randomUUID()}.webp`;
    const stored = await putPrivateWebp(entityId, result.data.bytes);
    if (!stored.ok) return NextResponse.json({ error: stored.message }, { status: 503 });
    return NextResponse.json({
      image: {
        imagePath: `/api/storage/objects/${entityId}`,
        altText: result.data.altText,
        prompt: result.data.prompt,
        model: result.data.model,
        contentType: 'image/webp',
      },
    }, { status: 201 });
  }

  const folder = targetFolder(data.target);
  if (!data.imagePath.startsWith(`/api/storage/objects/ai-images/${folder}/${target.slug}/`)) {
    return NextResponse.json({ error: 'Görsel yolu hedef içerikle eşleşmiyor.' }, { status: 400 });
  }
  try {
    const { db } = await import('@/db');
    const { content, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const now = new Date();
    if (data.placement === 'hero') {
      await db.update(content).set({ heroImage: data.imagePath, heroImageAlt: data.altText, updatedAt: now })
        .where(eq(content.id, target.id));
    } else {
      const body = data.target === 'SERVICE'
        ? (() => {
            const parsedBody = parseServicePageBody(target.body);
            return parsedBody
              ? JSON.stringify(appendServiceInlineImage(parsedBody, {
                  id: crypto.randomUUID(), src: data.imagePath, alt: data.altText,
                }))
              : null;
          })()
        : `${target.body ?? ''}\n\n![${data.altText.replace(/[[\]]/g, '\\$&')}](${data.imagePath})\n`;
      if (body === null) {
        return NextResponse.json({ error: 'Hizmet sayfası gövdesi geçerli yapılandırılmış JSON değil.' }, { status: 409 });
      }
      await db.update(content).set({ body, updatedAt: now })
        .where(eq(content.id, target.id));
    }
    await revalidateAttachedContent({ id: target.id, slug: target.slug, contentType: data.target });
    await db.insert(auditLogs).values({
      entityType: data.target === 'BLOG_POST' ? 'blog_post' : 'service_page',
      entityId: target.id, action: 'ai_image_attached', adminUserId: session.adminId,
      metadata: { placement: data.placement, imagePath: data.imagePath }, createdAt: now,
    } as never);
    return NextResponse.json({ imagePath: data.imagePath, placement: data.placement });
  } catch {
    return NextResponse.json({ error: 'Görsel içeriğe eklenemedi.' }, { status: 503 });
  }
}