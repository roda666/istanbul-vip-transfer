import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  href: z.string().min(1).max(500).optional(),
  location: z.enum(['HEADER', 'FOOTER', 'MOBILE']).optional(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { navigationItems, auditLogs } = await import('@/db/schema');
    const { eq, sql, asc } = await import('drizzle-orm');

    if (parsed.data && (body as { action?: string }).action) {
      const action = (body as { action?: string }).action;
      if (action !== 'up' && action !== 'down') return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 422 });
      const [current] = await db.select().from(navigationItems).where(eq(navigationItems.id, id)).limit(1);
      if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
      const result = await db.transaction(async tx => {
        const rows = await tx.select().from(navigationItems)
          .where(eq(navigationItems.location, current.location))
          .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.id));
        const index = rows.findIndex(r => r.id === id);
        const other = rows[index + (action === 'up' ? -1 : 1)];
        if (!other) return null;
        await tx.execute(sql`UPDATE navigation_items SET sort_order = CASE
          WHEN id = ${id} THEN ${other.sortOrder}
          WHEN id = ${other.id} THEN ${current.sortOrder}
          ELSE sort_order END WHERE id IN (${id}, ${other.id})`);
        return { id, otherId: other.id };
      });
      if (!result) return NextResponse.json({ error: 'Daha fazla hareket ettirilemiyor.' }, { status: 400 });
      return NextResponse.json({ ok: true, ...result });
    }
    const [updated] = await db.update(navigationItems).set({ ...parsed.data }).where(eq(navigationItems.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'NavigationItem', entityId: id }).catch(() => {});
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('Nav update error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  try {
    const { db } = await import('@/db');
    const { navigationItems, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [deleted] = await db.delete(navigationItems).where(eq(navigationItems.id, id)).returning({ id: navigationItems.id });
    if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'NavigationItem', entityId: id }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Nav delete error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
