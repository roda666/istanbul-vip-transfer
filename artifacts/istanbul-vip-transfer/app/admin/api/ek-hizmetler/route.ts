import { NextRequest, NextResponse } from 'next/server';
import { asc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, optionalServices } from '@/db/schema';
import { sanitizeText } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const serviceSchema = z.object({
  key: z.string().trim().min(2, 'Hizmet anahtarı en az 2 karakter olmalıdır.').max(80)
    .regex(/^[A-Z0-9_]+$/, 'Anahtar yalnızca büyük harf, rakam ve alt çizgi içerebilir.'),
  name: z.string().trim().min(1, 'Hizmet adı gereklidir.').max(200),
  currency: z.enum(['TRY', 'EUR', 'USD']),
  unitAmount: z.number().int().min(0, 'Tutar negatif olamaz.').max(100_000_000),
  chargeType: z.enum(['PER_BOOKING', 'PER_PERSON']),
  maximumQuantity: z.number().int().min(1, 'Azami adet en az 1 olmalıdır.').max(100),
  includedInTransfer: z.boolean(),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
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

    return NextResponse.json({ services });
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
    const data = parsed.data;
    const [item] = await db.insert(optionalServices).values({
      ...data,
      name: sanitizeText(data.name),
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'CREATE', entityType: 'OptionalService', entityId: item.id,
      metadata: { key: item.key, name: item.name },
    }).catch(() => {});
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu hizmet anahtarı zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('Optional service create error:', error);
    return NextResponse.json({ error: 'Ek hizmet kaydedilemedi.' }, { status: 503 });
  }
}