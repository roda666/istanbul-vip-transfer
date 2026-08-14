import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Slugs that must never be created via the generic content module.
 * / and locale roots are structural routes.
 * /ana-sayfa is managed exclusively by the homepage CMS editor.
 * /admin and /api prefixes collide with Next.js route groups.
 */
const RESERVED_SLUGS = new Set([
  'ana-sayfa',
  'admin',
  'api',
  'data',
  // Locale root paths — visitors navigate to /<lang> directly
  'en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl', 'tr',
]);

function isReservedSlug(slug: string): boolean {
  if (!slug) return false;
  const lower = slug.toLowerCase().trim();
  if (RESERVED_SLUGS.has(lower)) return true;
  // Block slugs that START with reserved path segments
  if (lower.startsWith('admin/') || lower.startsWith('api/') || lower.startsWith('data/')) return true;
  return false;
}

const createSchema = z.object({
  contentType: z.enum(['PAGE', 'SERVICE', 'BLOG_POST']),
  title: z.string().min(1, 'Başlık gereklidir').max(200),
  slug: z
    .string()
    .min(1, 'Slug gereklidir')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir'),
  excerpt: z.string().max(500).optional().nullable(),
  body: z.string().optional().nullable(),
  heroImage: z.string().max(500).optional().nullable(),
  heroImageAlt: z.string().max(200).optional().nullable(),
  // Terminal statuses (APPROVED, SCHEDULED, PUBLISHED) may only be set via
  // explicit action endpoints (approve / publish). ARCHIVED is also blocked on
  // create — content cannot start in a terminal or archived state.
  status: z.enum(['DRAFT', 'RESEARCH', 'REVIEW']).default('DRAFT'),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(400).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  indexable: z.boolean().optional().default(true),
  scheduledAt: z.string().datetime().optional().nullable(),
});

/** GET /api/admin/content?type=PAGE&page=1&limit=20 */
export async function GET(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    const { db } = await import('@/db');
    const { content } = await import('@/db/schema');
    const { eq, desc, count } = await import('drizzle-orm');

    const where = type ? eq(content.contentType, type as 'PAGE' | 'SERVICE' | 'BLOG_POST') : undefined;

    const [items, totalRows] = await Promise.all([
      db.select().from(content).where(where).orderBy(desc(content.updatedAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(content).where(where),
    ]);

    return NextResponse.json({ items, total: totalRows[0]?.count ?? 0 });
  } catch (err) {
    console.error('Content list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /api/admin/content */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  const data = parsed.data;

  if (isReservedSlug(data.slug)) {
    return NextResponse.json(
      { error: `"${data.slug}" ayrılmış bir slug'dır ve bu modülde kullanılamaz.` },
      { status: 422 },
    );
  }

  const { sanitizeHtml, sanitizeText } = await import('@/lib/sanitize');

  try {
    const { db } = await import('@/db');
    const { content, auditLogs } = await import('@/db/schema');

    const [newItem] = await db
      .insert(content)
      .values({
        contentType: data.contentType,
        title: sanitizeText(data.title),
        slug: data.slug,
        excerpt: data.excerpt ? sanitizeText(data.excerpt) : null,
        body: data.body ? sanitizeHtml(data.body) : null,
        heroImage: data.heroImage ? sanitizeText(data.heroImage) : null,
        heroImageAlt: data.heroImageAlt ? sanitizeText(data.heroImageAlt) : null,
        status: data.status,
        seoTitle: data.seoTitle ? sanitizeText(data.seoTitle) : null,
        seoDescription: data.seoDescription ? sanitizeText(data.seoDescription) : null,
        canonicalUrl: data.canonicalUrl ? sanitizeText(data.canonicalUrl) : null,
        indexable: data.indexable,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      })
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'Content',
      entityId: newItem.id,
      metadata: { title: newItem.title, contentType: newItem.contentType },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('Content create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
