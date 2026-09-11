import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidateHomepageLocale } from '@/lib/homepage-revalidation';

const updateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  contentId: z.string().uuid().optional(),
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
    const { faqs, auditLogs } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    const [current] = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
    if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
    const action = (body as { action?: string }).action;
    if (action === 'up' || action === 'down') {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.select({ id: faqs.id, sortOrder: faqs.sortOrder })
          .from(faqs).orderBy(faqs.sortOrder, faqs.id);
        const index = rows.findIndex(r => r.id === id);
        const other = rows[index + (action === 'up' ? -1 : 1)];
        if (!other) return null;
        await tx.execute(sql`UPDATE faqs SET sort_order = CASE
          WHEN id = ${id} THEN ${other.sortOrder}
          WHEN id = ${other.id} THEN ${current.sortOrder}
          ELSE sort_order END WHERE id IN (${id}, ${other.id})`);
        return { id, otherId: other.id };
      });
      if (!result) return NextResponse.json({ error: 'Daha fazla hareket ettirilemiyor.' }, { status: 400 });
      return NextResponse.json({ ok: true, ...result });
    }
    const { fillMissingTranslations } = await import('@/lib/ai/fill-missing-translations');
    const translations = await fillMissingTranslations({
      question: parsed.data.question ?? current.question,
      answer: parsed.data.answer ?? current.answer,
    }, current.translations ?? {});
    const [updated] = await db.update(faqs).set({ ...parsed.data, translations }).where(eq(faqs.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'FAQ', entityId: id }).catch(() => {});
    revalidateHomepageLocale('tr');
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('FAQ update error:', err);
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
    const { faqs, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [deleted] = await db.delete(faqs).where(eq(faqs.id, id)).returning({ id: faqs.id });
    if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'FAQ', entityId: id }).catch(() => {});
    revalidateHomepageLocale('tr');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('FAQ delete error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
