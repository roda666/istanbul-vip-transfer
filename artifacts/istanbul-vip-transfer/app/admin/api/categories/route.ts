/**
 * GET  /admin/api/categories — list all categories with service counts
 * POST /admin/api/categories — create a new category (TR name → auto-translate)
 */
import { NextRequest, NextResponse } from 'next/server';
import { invalidateServiceCategories } from '@/lib/service-category-server';

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0, 60);
}

// ── GET ───────────────────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR'];

export async function GET() {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!PRIVILEGED_ROLES.includes(session.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { db }   = await import('@/db');
    const { serviceCategories } = await import('@/db/schema');
    const { sql, asc } = await import('drizzle-orm');

    const rows = await db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder));

    // Attach service counts via raw subquery
    const counts = await db.execute(sql`
      SELECT category, COUNT(*)::int AS cnt
      FROM content
      WHERE content_type = 'SERVICE'
      GROUP BY category
    `);
    const countMap: Record<string, number> = {};
    for (const row of Array.from(counts) as {category: string; cnt: number}[]) {
      if (row.category) countMap[row.category] = row.cnt;
    }

    const result = rows.map(r => ({
      ...r,
      serviceCount: countMap[r.slug] ?? 0,
    }));

    return NextResponse.json({ categories: result });
  } catch (err) {
    console.error('GET /admin/api/categories error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role))
    return NextResponse.json({ error: 'Forbidden — sadece ADMIN veya SUPER_ADMIN ekleyebilir.' }, { status: 403 });

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const { nameTr } = body as { nameTr?: string };
  if (!nameTr?.trim())
    return NextResponse.json({ error: 'Türkçe isim zorunludur.' }, { status: 422 });

  const slug = toSlug(nameTr);
  if (!slug)
    return NextResponse.json({ error: 'Geçerli slug oluşturulamadı.' }, { status: 422 });

  // Auto-translate to 8 other languages
  const LANGS: Record<string, string> = {
    en: 'English', de: 'German', ar: 'Arabic', ru: 'Russian',
    es: 'Spanish', fr: 'French', it: 'Italian', nl: 'Dutch',
  };

  const translations: Record<string, string> = { tr: nameTr.trim() };

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    await Promise.allSettled(
      Object.entries(LANGS).map(async ([code, lang]) => {
        const res = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: `Translate this Turkish service category name to ${lang}. Return ONLY the translated name, nothing else. Keep it short (1-5 words). This is for a VIP airport transfer company.`,
            },
            { role: 'user', content: nameTr.trim() },
          ],
          temperature: 0.1,
          max_tokens: 30,
        });
        translations[code] = res.choices[0]?.message?.content?.trim() ?? nameTr.trim();
      })
    );
  } catch (err) {
    console.warn('Auto-translation failed, using TR fallback:', err);
    for (const code of Object.keys(LANGS)) translations[code] = nameTr.trim();
  }

  try {
    const { db }   = await import('@/db');
    const { serviceCategories, auditLogs } = await import('@/db/schema');
    const { sql }  = await import('drizzle-orm');

    // Get next sort_order
    const maxRow = await db.execute(sql`SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM service_categories`);
    const nextOrder = (Array.from(maxRow)[0] as {next: number}).next ?? 1;

    const [created] = await db.insert(serviceCategories).values({
      slug,
      nameTranslations: translations,
      sortOrder: nextOrder,
      isActive:  true,
    }).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action:      'CREATE',
      entityType:  'ServiceCategory',
      entityId:    String(created.id),
    }).catch(() => {});

    invalidateServiceCategories();
    return NextResponse.json({ category: { ...created, serviceCount: 0 } }, { status: 201 });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('unique')) {
      return NextResponse.json({ error: `"${slug}" slug zaten kullanımda.` }, { status: 409 });
    }
    console.error('POST /admin/api/categories error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
