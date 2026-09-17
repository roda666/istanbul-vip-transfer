import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().default(true),
  quoteEnabled: z.boolean().default(true),
  reservationEnabled: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

/** GET /admin/api/service-types — list all service types */
export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { serviceTypes } = await import('@/db/schema');
    const { asc } = await import('drizzle-orm');
    const items = await db.select().from(serviceTypes).orderBy(asc(serviceTypes.displayOrder));
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Service types list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /admin/api/service-types — create a service type and its live translations */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  try {
    const { sanitizeText } = await import('@/lib/sanitize');
    const { syncServiceTypeTranslations, serviceTypeKeyFromLabel } = await import('@/lib/service-type-localization');
    const { db } = await import('@/db');
    const { serviceTypes, auditLogs } = await import('@/db/schema');
    const label = sanitizeText(parsed.data.label);
    const description = parsed.data.description ? sanitizeText(parsed.data.description) : null;
    const key = serviceTypeKeyFromLabel(label);
    const translations = await syncServiceTypeTranslations({
      label,
      description,
      changedFields: ['label', 'description'],
    });

    const [created] = await db.insert(serviceTypes).values({
      key,
      label,
      description,
      translations,
      enabled: parsed.data.enabled,
      quoteEnabled: parsed.data.quoteEnabled,
      reservationEnabled: parsed.data.reservationEnabled,
      displayOrder: parsed.data.displayOrder,
      updatedBy: session.adminId,
    }).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'ServiceType',
      entityId: created.id,
      metadata: { key },
    }).catch(() => {});

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/data/service-types');
    const { revalidateBookingFormBootstrap } = await import('@/lib/booking-form-bootstrap');
    revalidateBookingFormBootstrap();
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === '23505') {
      return NextResponse.json(
        { error: 'Bu adla aynı sistem anahtarını kullanan bir hizmet türü zaten var.' },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('çeviri') || message.includes('güvenlik kontrolünden')) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Hizmet türü oluşturulamadı.' }, { status: 503 });
  }
}
