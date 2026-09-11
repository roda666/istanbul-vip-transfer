import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, contentTranslations, languages, optionalServices } from '@/db/schema';
import { sanitizeText } from '@/lib/sanitize';
import { FLIGHT_MEET_GREET_KEY, normalizeFlightMeetGreetKey } from '@/lib/flight-meet-greet-contract';
import { isCanonicalNonEmptyScope } from '@/lib/service-type-scope';

export const dynamic = 'force-dynamic';

const serviceSchema = z.object({
  key: z.string().trim().min(2, 'Hizmet anahtarı en az 2 karakter olmalıdır.').max(80)
    .refine((key) => normalizeFlightMeetGreetKey(key) === FLIGHT_MEET_GREET_KEY || /^[A-Z0-9_]+$/.test(key), 'Geçersiz hizmet anahtarı.'),
  name: z.string().trim().min(1, 'Hizmet adı gereklidir.').max(200),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  currency: z.enum(['TRY', 'EUR', 'USD']),
  unitAmount: z.number().int().positive('Tutar sıfırdan büyük olmalıdır.').max(100_000_000),
  chargeType: z.enum(['PER_BOOKING', 'PER_PERSON']),
  maximumQuantity: z.number().int().min(1, 'Azami adet en az 1 olmalıdır.').max(100),
  includedInTransfer: z.boolean(),
  serviceTypeScope: z.array(z.string().min(1).max(80)).max(20).default([]),
  automaticServiceTypes: z.array(z.string().min(1).max(80)).max(20).default([]),
  customerVisible: z.boolean().default(true),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
}).refine((data) => data.includedInTransfer || isCanonicalNonEmptyScope(data.serviceTypeScope), {
  message: 'Ayrı ücretli hizmetlerde hizmet türü kapsamı boş bırakılamaz; AIRPORT_TRANSFER, INTERCITY, ALLOCATION veya TOUR seçin.',
}).refine((data) => data.chargeType !== 'PER_BOOKING' || data.maximumQuantity === 1, {
  message: 'Rezervasyon başı hizmetlerde azami adet 1 olmalıdır.',
});

function authError(error: unknown) {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status?: number }).status
    : 401;
  return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: status === 403 ? 403 : 401 });
}

/** Admin-only optional-service catalog. Archived rows are available with ?archived=true. */
export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch (error) {
    return authError(error);
  }

  try {
    const archivedOnly = request.nextUrl.searchParams.get('archived') === 'true';
    const services = await db
      .select({
        id: optionalServices.id,
        key: optionalServices.key,
        name: optionalServices.name,
        shortDescription: optionalServices.shortDescription,
        serviceTypeScope: optionalServices.serviceTypeScope,
        automaticServiceTypes: optionalServices.automaticServiceTypes,
        customerVisible: optionalServices.customerVisible,
        currency: optionalServices.currency,
        unitAmount: optionalServices.unitAmount,
        chargeType: optionalServices.chargeType,
        maximumQuantity: optionalServices.maximumQuantity,
        includedInTransfer: optionalServices.includedInTransfer,
        active: optionalServices.active,
        displayOrder: optionalServices.displayOrder,
        archivedAt: optionalServices.archivedAt,
      })
      .from(optionalServices)
      .where(archivedOnly ? undefined : isNull(optionalServices.archivedAt))
      .orderBy(asc(optionalServices.displayOrder), asc(optionalServices.name));

    const translationRows = await db.select({
      entityId: contentTranslations.entityId,
      targetLanguageCode: contentTranslations.targetLanguageCode,
      status: contentTranslations.status,
    }).from(contentTranslations).where(eq(contentTranslations.entityType, 'optional_service'));
    const translationStatus = new Map<string, Record<string, string>>();
    for (const row of translationRows) {
      const current = translationStatus.get(row.entityId) ?? {};
      current[row.targetLanguageCode] = row.status;
      translationStatus.set(row.entityId, current);
    }
    return NextResponse.json({ services: services.map((service) => ({
      ...service, translationStatus: translationStatus.get(service.id) ?? {},
    })) });
  } catch (error) {
    console.error('Optional services GET error:', error);
    return NextResponse.json({ error: 'Ek hizmetler alınamadı.' }, { status: 503 });
  }
}

/** Create an optional service. Monetary amounts are sent/stored in minor units. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch (error) {
    return authError(error);
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const data = { ...parsed.data, key: normalizeFlightMeetGreetKey(parsed.data.key) === FLIGHT_MEET_GREET_KEY ? FLIGHT_MEET_GREET_KEY : parsed.data.key };
    const [item] = await db.insert(optionalServices).values({
      ...data,
      name: sanitizeText(data.name),
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();
    const targets = await db.select({ code: languages.code }).from(languages)
      .where(and(eq(languages.isEnabled, true), ne(languages.code, 'tr')));
    if (targets.length) {
      await db.insert(contentTranslations).values(targets.map((target) => ({
        entityType: 'optional_service', entityId: item.id, sourceLanguageCode: 'tr',
        targetLanguageCode: target.code, status: 'QUEUED' as const, queuedAt: new Date(),
        serviceName: item.name, serviceShortDescription: item.shortDescription,
        createdBy: session.adminId, updatedBy: session.adminId,
      }))).onConflictDoNothing();
    }
    const { queueOptionalServiceTranslations } = await import('@/lib/optional-service-translations');
    const translationJob = await queueOptionalServiceTranslations(item.id, session.adminId);
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'CREATE', entityType: 'OptionalService', entityId: item.id,
      metadata: { key: item.key, name: item.name },
    }).catch(() => {});
    return NextResponse.json({ item, translationJob }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu hizmet anahtarı zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('Optional service create error:', error);
    return NextResponse.json({ error: 'Ek hizmet kaydedilemedi.' }, { status: 503 });
  }
}