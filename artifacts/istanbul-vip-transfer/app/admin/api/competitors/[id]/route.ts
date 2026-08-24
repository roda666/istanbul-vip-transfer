import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  label: z.string().trim().min(1, 'Görünen ad zorunludur.').max(120).optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  active: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, 'Güncellenecek bir alan gönderin.');

async function admin() {
  const session = await requireAdminSession();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) throw new Error('forbidden');
  return session;
}
function idFrom(params: { id: string }) {
  const id = Number(params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await admin(); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === 'forbidden' ? 'Bu işlem için ADMIN veya SUPER_ADMIN yetkisi gerekir.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 }); }
  const id = idFrom(await params);
  if (!id) return NextResponse.json({ error: 'Geçersiz rakip kimliği.' }, { status: 422 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { competitorSites, auditLogs } = await import('@/db/schema');
    const { sanitizeText } = await import('@/lib/sanitize');
    const data = parsed.data;
    const [item] = await db.update(competitorSites).set({
      ...(data.label !== undefined ? { label: sanitizeText(data.label) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ? sanitizeText(data.notes) : null } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      updatedAt: new Date(),
    }).where(eq(competitorSites.id, id)).returning();
    if (!item) return NextResponse.json({ error: 'Rakip sitesi bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'CompetitorSite', entityId: String(id), metadata: { active: item.active } }).catch(() => {});
    return NextResponse.json({ item });
  } catch { return NextResponse.json({ error: 'Rakip sitesi güncellenemedi. Lütfen tekrar deneyin.' }, { status: 503 }); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await admin(); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === 'forbidden' ? 'Bu işlem için ADMIN veya SUPER_ADMIN yetkisi gerekir.' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 }); }
  const id = idFrom(await params);
  if (!id) return NextResponse.json({ error: 'Geçersiz rakip kimliği.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { competitorSites, auditLogs } = await import('@/db/schema');
    const [item] = await db.delete(competitorSites).where(eq(competitorSites.id, id)).returning();
    if (!item) return NextResponse.json({ error: 'Rakip sitesi bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'CompetitorSite', entityId: String(id), metadata: { domain: item.domain } }).catch(() => {});
    return NextResponse.json({ deleted: true });
  } catch { return NextResponse.json({ error: 'Rakip sitesi silinemedi. Lütfen tekrar deneyin.' }, { status: 503 }); }
}