import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, contentTranslations, languages, optionalServices } from '@/db/schema';
import { sanitizeText } from '@/lib/sanitize';
import { FLIGHT_MEET_GREET_KEY, normalizeFlightMeetGreetKey } from '@/lib/flight-meet-greet-contract';
import { isCanonicalServiceType } from '@/lib/service-type-scope';

const updateSchema = z.object({
  action: z.enum(['restore', 'archive']).optional(),
  key: z.string().trim().min(2).max(80).refine((key) => normalizeFlightMeetGreetKey(key) === FLIGHT_MEET_GREET_KEY || /^[A-Z0-9_]+$/.test(key), 'Geçersiz hizmet anahtarı.').optional(),
  name: z.string().trim().min(1, 'Hizmet adı gereklidir.').max(200).optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  currency: z.enum(['TRY', 'EUR', 'USD']).optional(),
  unitAmount: z.number().int().positive('Tutar sıfırdan büyük olmalıdır.').max(100_000_000).optional(),
  chargeType: z.enum(['PER_BOOKING', 'PER_PERSON']).optional(),
  maximumQuantity: z.number().int().min(1, 'Azami adet en az 1 olmalıdır.').max(100).optional(),
  includedInTransfer: z.boolean().optional(),
  serviceTypeScope: z.array(z.string().min(1).max(80)).max(20).optional(),
  automaticServiceTypes: z.array(z.string().min(1).max(80)).max(20).optional(),
  customerVisible: z.boolean().optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
}).refine((data) => Object.keys(data).length > 0, 'Güncellenecek bir alan gönderin.')
  .refine((data) => (data.serviceTypeScope === undefined || data.serviceTypeScope.every(isCanonicalServiceType))
    && (data.automaticServiceTypes === undefined || data.automaticServiceTypes.every(isCanonicalServiceType)), {
    message: 'Geçersiz hizmet türü kapsamı seçildi.',
  });

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

    if (data.action === 'restore') {
      const [current] = await db.select().from(optionalServices).where(eq(optionalServices.id, id)).limit(1);
      if (!current) return NextResponse.json({ error: 'Hizmet bulunamadı.' }, { status: 404 });
      if (!current.archivedAt) return NextResponse.json({ error: 'Sadece arşivlenmiş hizmetler geri yüklenebilir.' }, { status: 422 });

      const [item] = await db.update(optionalServices)
        .set({ archivedAt: null, active: false, updatedAt: new Date(), updatedBy: session.adminId })
        .where(eq(optionalServices.id, id))
        .returning();

      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'RESTORE', entityType: 'OptionalService', entityId: id,
        metadata: { key: item.key, name: item.name },
      }).catch(() => {});
      return NextResponse.json({ item });
    }

    if (data.action === 'archive') {
      const [current] = await db.select().from(optionalServices).where(eq(optionalServices.id, id)).limit(1);
      if (!current) return NextResponse.json({ error: 'Hizmet bulunamadı.' }, { status: 404 });
      if (current.archivedAt) return NextResponse.json({ error: 'Hizmet zaten arşivlenmiş.' }, { status: 422 });

      const [item] = await db.update(optionalServices)
        .set({ archivedAt: new Date(), active: false, updatedAt: new Date(), updatedBy: session.adminId })
        .where(eq(optionalServices.id, id))
        .returning();

      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'ARCHIVE', entityType: 'OptionalService', entityId: id,
        metadata: { key: item.key, name: item.name },
      }).catch(() => {});
      return NextResponse.json({ item });
    }

    const [current] = await db.select().from(optionalServices).where(eq(optionalServices.id, id)).limit(1);
    if (!current) return NextResponse.json({ error: 'Hizmet bulunamadı.' }, { status: 404 });
    let translationJob: unknown = null;
    const normalizedData = {
      ...(normalizeFlightMeetGreetKey(data.key) === FLIGHT_MEET_GREET_KEY ? { ...data, key: FLIGHT_MEET_GREET_KEY } : data),
      ...(data.chargeType === 'PER_BOOKING' ? { maximumQuantity: 1 } : {}),
    };
    const [item] = await db.update(optionalServices).set({
      ...normalizedData,
      ...(normalizedData.name !== undefined ? { name: sanitizeText(normalizedData.name) } : {}),
      updatedAt: new Date(), updatedBy: session.adminId,
    }).where(eq(optionalServices.id, id)).returning();
    if (normalizedData.name !== undefined || normalizedData.shortDescription !== undefined) {
      const targets = await db.select({ code: languages.code }).from(languages)
        .where(and(eq(languages.isEnabled, true), ne(languages.code, 'tr')));
      await Promise.all(targets.map(async ({ code }) => {
        await db.insert(contentTranslations).values({
          entityType: 'optional_service', entityId: id, sourceLanguageCode: 'tr',
          targetLanguageCode: code, status: 'QUEUED', queuedAt: new Date(),
          serviceName: item.name, serviceShortDescription: item.shortDescription,
          updatedAt: new Date(), updatedBy: session.adminId,
        }).onConflictDoUpdate({
          target: [contentTranslations.entityType, contentTranslations.entityId, contentTranslations.targetLanguageCode],
          set: { status: 'QUEUED', queuedAt: new Date(), serviceName: item.name, serviceShortDescription: item.shortDescription, updatedAt: new Date(), updatedBy: session.adminId },
        });
      }));
      const { queueOptionalServiceTranslations } = await import('@/lib/optional-service-translations');
      translationJob = await queueOptionalServiceTranslations(id, session.adminId);
    }
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'UPDATE', entityType: 'OptionalService', entityId: id,
      metadata: { key: item.key, name: item.name },
    }).catch(() => {});
    return NextResponse.json({ item, translationJob: translationJob ?? null });
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
    if (!current.archivedAt) {
      return NextResponse.json({ error: 'Yalnızca arşivlenmiş hizmetler kalıcı olarak silinebilir. Lütfen önce arşivleyin.' }, { status: 422 });
    }
    await db.delete(optionalServices).where(eq(optionalServices.id, id));
    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'OptionalService', entityId: id, metadata: { key: current.key } }).catch(() => {});
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Optional service delete error:', error);
    return NextResponse.json({ error: 'Ek hizmet silinemedi.' }, { status: 503 });
  }
}