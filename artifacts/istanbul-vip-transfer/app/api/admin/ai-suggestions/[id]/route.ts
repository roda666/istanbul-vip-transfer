import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  suggestedTitle: z.string().max(300).optional().nullable(),
  primaryKeyword: z.string().max(200).optional().nullable(),
  secondaryKeywords: z.string().max(500).optional().nullable(),
  searchIntent: z.string().max(100).optional().nullable(),
  articleType: z.string().max(100).optional().nullable(),
  targetService: z.string().max(100).optional().nullable(),
  targetLocation: z.string().max(100).optional().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE', 'REJECTED']).optional(),
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
    const { aiContentSuggestions, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [updated] = await db.update(aiContentSuggestions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(aiContentSuggestions.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'AISuggestion', entityId: id }).catch(() => {});
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('AI suggestion update error:', err);
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
    const { aiContentSuggestions, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [deleted] = await db.delete(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).returning({ id: aiContentSuggestions.id });
    if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'AISuggestion', entityId: id }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('AI suggestion delete error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
