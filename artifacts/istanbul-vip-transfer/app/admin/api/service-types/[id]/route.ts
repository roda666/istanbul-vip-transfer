import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  enabled: z.boolean().optional(),
  quoteEnabled: z.boolean().optional(),
  reservationEnabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

/** PATCH /admin/api/service-types/[id] */
export async function PATCH(request: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );

  const data = parsed.data;
  const { db } = await import('@/db');
  const { serviceTypes, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select({
      id: serviceTypes.id,
      key: serviceTypes.key,
      label: serviceTypes.label,
      description: serviceTypes.description,
      translations: serviceTypes.translations,
    })
    .from(serviceTypes)
    .where(eq(serviceTypes.id, id))
    .limit(1)
    .catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  const { sanitizeText } = await import('@/lib/sanitize');
  const nextLabel = data.label !== undefined ? sanitizeText(data.label) : current.label;
  const nextDescription = data.description !== undefined
    ? (data.description ? sanitizeText(data.description) : null)
    : current.description;
  const changedTextFields: Array<'label' | 'description'> = [];
  const { AUTO_TRANSLATION_LOCALES } = await import('@/lib/ai/fill-missing-translations');
  const hasMissingTranslation = (field: 'label' | 'description') =>
    AUTO_TRANSLATION_LOCALES.some((locale) => {
      const value = current.translations?.[locale]?.[field];
      return field === 'description' && !nextDescription
        ? value !== null
        : typeof value !== 'string' || value.trim().length === 0;
    });
  if (nextLabel !== current.label || (data.label !== undefined && hasMissingTranslation('label'))) {
    changedTextFields.push('label');
  }
  if (
    nextDescription !== current.description
    || (data.description !== undefined && hasMissingTranslation('description'))
  ) {
    changedTextFields.push('description');
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.adminId };
  if (data.label !== undefined) updateValues.label = nextLabel;
  if (data.description !== undefined) updateValues.description = nextDescription;
  if (data.enabled !== undefined) updateValues.enabled = data.enabled;
  if (data.quoteEnabled !== undefined) updateValues.quoteEnabled = data.quoteEnabled;
  if (data.reservationEnabled !== undefined) updateValues.reservationEnabled = data.reservationEnabled;
  if (data.displayOrder !== undefined) updateValues.displayOrder = data.displayOrder;

  try {
    if (changedTextFields.length > 0) {
      const { syncServiceTypeTranslations } = await import('@/lib/service-type-localization');
      updateValues.translations = await syncServiceTypeTranslations({
        label: nextLabel,
        description: nextDescription,
        existing: current.translations,
        changedFields: changedTextFields,
      });
    }
    const [updated] = await db
      .update(serviceTypes)
      .set(updateValues)
      .where(eq(serviceTypes.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'ServiceType',
      entityId: id,
      metadata: { key: current.key, changes: Object.keys(data) },
    }).catch(() => {});

    // Invalidate the public service-types cache
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/data/service-types');
    const { revalidateBookingFormBootstrap } = await import('@/lib/booking-form-bootstrap');
    revalidateBookingFormBootstrap();

    return NextResponse.json({ item: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('çeviri') || message.includes('güvenlik kontrolünden')) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
