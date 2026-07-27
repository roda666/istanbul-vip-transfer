import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const navSchema = z.object({
  label: z.string().min(1, 'Etiket gereklidir').max(100),
  href: z.string().min(1, 'URL gereklidir').max(500),
  location: z.enum(['HEADER', 'FOOTER', 'MOBILE']),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try { await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = request.nextUrl;
  const location = searchParams.get('location');

  try {
    const { db } = await import('@/db');
    const { navigationItems } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');

    const rows = await db.select().from(navigationItems)
      .where(location ? eq(navigationItems.location, location as 'HEADER' | 'FOOTER' | 'MOBILE') : undefined)
      .orderBy(asc(navigationItems.sortOrder));

    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error('Nav list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = navSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { navigationItems, auditLogs } = await import('@/db/schema');
    const [newItem] = await db.insert(navigationItems).values(parsed.data).returning();
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'CREATE', entityType: 'NavigationItem', entityId: newItem.id, metadata: { label: newItem.label } }).catch(() => {});
    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err) {
    console.error('Nav create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
