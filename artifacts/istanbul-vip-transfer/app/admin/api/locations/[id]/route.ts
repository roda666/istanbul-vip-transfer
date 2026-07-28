import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1).max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir')
    .optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(200).optional().nullable(),
  type: z.enum(['AIRPORT', 'DISTRICT', 'REGION', 'HOTEL_ZONE', 'CUSTOM']).optional(),
  pickupEnabled: z.boolean().optional(),
  dropoffEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string }> };

/** GET /admin/api/locations/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { locations } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db.select().from(locations).where(eq(locations.id, id)).limit(1).catch(() => []);
  if (!rows[0]) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

/** PATCH /admin/api/locations/[id] */
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
  const { locations, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select({ id: locations.id, pickupEnabled: locations.pickupEnabled, dropoffEnabled: locations.dropoffEnabled })
    .from(locations).where(eq(locations.id, id)).limit(1).catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  // Enforce at least one of pickup/dropoff enabled
  const nextPickup = data.pickupEnabled ?? current.pickupEnabled;
  const nextDropoff = data.dropoffEnabled ?? current.dropoffEnabled;
  if (!nextPickup && !nextDropoff) {
    return NextResponse.json(
      { error: 'En az biri etkin olmalıdır: Alış veya Bırakış.' },
      { status: 422 },
    );
  }

  const { sanitizeText } = await import('@/lib/sanitize');
  const updateValues: Record<string, unknown> = { updatedAt: new Date(), updatedBy: session.adminId };

  if (data.name !== undefined) updateValues.name = sanitizeText(data.name);
  if (data.slug !== undefined) updateValues.slug = data.slug;
  if (data.city !== undefined) updateValues.city = sanitizeText(data.city);
  if (data.district !== undefined) updateValues.district = data.district ? sanitizeText(data.district) : null;
  if (data.type !== undefined) updateValues.type = data.type;
  if (data.pickupEnabled !== undefined) updateValues.pickupEnabled = data.pickupEnabled;
  if (data.dropoffEnabled !== undefined) updateValues.dropoffEnabled = data.dropoffEnabled;
  if (data.isActive !== undefined) updateValues.isActive = data.isActive;
  if (data.displayOrder !== undefined) updateValues.displayOrder = data.displayOrder;

  try {
    const [updated] = await db.update(locations).set(updateValues).where(eq(locations.id, id)).returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'Location',
      entityId: id,
      metadata: { name: updated.name },
    }).catch(() => {});

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate'))
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    console.error('Location update error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** DELETE /admin/api/locations/[id]
 *  First call: sets archivedAt (soft archive).
 *  Second call (when already archived): permanent delete.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { locations, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select({ id: locations.id, name: locations.name, archivedAt: locations.archivedAt })
    .from(locations).where(eq(locations.id, id)).limit(1).catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  if (!current.archivedAt) {
    // First step: archive (soft delete)
    const [updated] = await db.update(locations)
      .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date(), updatedBy: session.adminId })
      .where(eq(locations.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'ARCHIVE',
      entityType: 'Location',
      entityId: id,
      metadata: { name: current.name },
    }).catch(() => {});

    return NextResponse.json({ item: updated, archived: true });
  } else {
    // Second step: permanent delete
    await db.delete(locations).where(eq(locations.id, id));

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'Location',
      entityId: id,
      metadata: { name: current.name },
    }).catch(() => {});

    return NextResponse.json({ success: true, deleted: true });
  }
}
