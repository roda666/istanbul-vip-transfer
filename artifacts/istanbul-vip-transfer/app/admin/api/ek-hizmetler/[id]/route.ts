import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, optionalServices } from '@/db/schema';
import { sanitizeText } from '@/lib/sanitize';

const updateSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[A-Z0-9_]+$/, 'Anahtar yalnızca büyük harf, rakam ve alt çizgi içerebilir.').optional(),
  name: z.string().trim().min(1, 'Hizmet adı gereklidir.').max(200).optional(),
  currency: z.enum(['TRY', 'EUR', 'USD']).optional(),
  unitAmount: z.number().int().min(0, 'Tutar negatif olamaz.').max(100_000_000).optional(),
  chargeType: z.enum(['PER_BOOKING', 'PER_PERSON']).optional(),
  maximumQuantity: z.number().int().min(1, 'Azami adet en az 1 olmalıdır.').max(100).optional(),
  includedInTransfer: z.boolean().optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
}).refine((data) => Object.keys(data).length > 0, 'Güncellenecek bir alan gönderin.');

type Params = { params: Promise<{ id: string }> };
function unauthorized() { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

export async function PATCH(request: NextRequest, { params }: Params) {
  let session;
  try { session = await requireAdminSession(); } catch { return unauthorized(); }
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  const { id } = await params;
  try {
    const data = parsed.data;
    const [item] = await db.update(optionalServices).set({
      ...data,
      ...(data.name !== undefined ? { name: sanitizeText(data.name) } : {}),
      updatedAt: new Date(), updatedBy: session.adminId,
    }).where(eq(optionalServices.id, id)).returning();
    if (!item) return NextResponse.json({ error: 'Hizmet bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'UPDATE', entityType: 'OptionalService', entityId: id,
      metadata: { key: item.key, name: item.name },
    }).catch(() => {});
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('unique') || message.includes('duplicate')) return NextResponse.json({ error: 'Bu hizmet anahtarı zaten kullanılıyor.' }, { status: 409 });
    console.error('Optional service update error:', error);
    return NextResponse.json({ error: 'Ek hizmet güncellenemedi.' }, { status: 503 });
  }
}

/** First delete archives a service; deleting an archived service permanently removes it. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  let session;
  try { session = await requireAdminSession(); } catch { return unauthorized(); }
  const { id } = await params;
  const [current] = await db.select().from(optionalServices).where(eq(optionalServices.id, id)).limit(1).catch(() => []);
  if (!current) return NextResponse.json({ error: 'Hizmet bulunamadı.' }, { status: 404 });
  try {
    if (current.archivedAt) {
      await db.delete(optionalServices).where(eq(optionalServices.id, id));
      await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'OptionalService', entityId: id, metadata: { key: current.key } }).catch(() => {});
      return NextResponse.json({ success: true, deleted: true });
    }
    const [item] = await db.update(optionalServices).set({
      active: false, archivedAt: new Date(), updatedAt: new Date(), updatedBy: session.adminId,
    }).where(eq(optionalServices.id, id)).returning();
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'ARCHIVE', entityType: 'OptionalService', entityId: id, metadata: { key: current.key } }).catch(() => {});
    return NextResponse.json({ item, archived: true });
  } catch (error) {
    console.error('Optional service delete error:', error);
    return NextResponse.json({ error: 'Ek hizmet silinemedi.' }, { status: 503 });
  }
}