import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transferRouteDisplayOrder, vehicleDisplayOrder } from '@/lib/inventory-order';

const common = {
  vehicleId: z.string().uuid(),
  active: z.boolean().default(true),
  notes: z.string().max(1_000).nullable().optional(),
};
const distanceSchema = z.object({
  ...common,
  mode: z.literal('DISTANCE'),
  distanceOpeningKurus: z.number().int().min(0),
  distanceFirstKmKurus: z.number().int().min(0),
  distanceThresholdKm: z.number().int().min(1),
  distanceSecondKmKurus: z.number().int().min(0),
});
const hourlySchema = z.object({
  ...common,
  mode: z.literal('HOURLY'),
  hourlyRateKurus: z.number().int().min(1),
  minimumHours: z.number().int().min(1).max(720),
  includedKmMode: z.enum(['PER_HOUR', 'PACKAGE']),
  includedKm: z.number().int().min(0),
  excessKmKurus: z.number().int().min(0),
  excessHourKurus: z.number().int().min(0),
});
const profileSchema = z.discriminatedUnion('mode', [distanceSchema, hourlySchema]);

export async function GET(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [{ db }, { locations, transferRoutes, vehiclePricingProfiles, vehicles }, { and, asc, desc, eq, isNull }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);
  const vehicleId = new URL(request.url).searchParams.get('vehicleId');
  const [profiles, vehicleRows, routeRows, locationRows] = await Promise.all([
    db.select().from(vehiclePricingProfiles).orderBy(desc(vehiclePricingProfiles.updatedAt)),
    db.select({
      id: vehicles.id,
      name: vehicles.name,
      pricingClass: vehicles.pricingClass,
      tollClass: vehicles.tollClass,
      status: vehicles.status,
    }).from(vehicles).orderBy(...vehicleDisplayOrder()),
    db.select({
      id: transferRoutes.id, name: transferRoutes.name, originLocationId: transferRoutes.originLocationId,
      destinationLocationId: transferRoutes.destinationLocationId, defaultVehicleId: transferRoutes.defaultVehicleId,
      distanceKm: transferRoutes.distanceKm, distanceSource: transferRoutes.distanceSource, active: transferRoutes.active,
    }).from(transferRoutes).where(eq(transferRoutes.active, true)).orderBy(...transferRouteDisplayOrder()),
    db.select({
      id: locations.id, name: locations.name, city: locations.city, type: locations.type,
      latitude: locations.latitude, longitude: locations.longitude, istanbulSide: locations.istanbulSide,
    })
      .from(locations)
      .where(and(eq(locations.isActive, true), isNull(locations.archivedAt)))
      .orderBy(asc(locations.name)),
  ]);
  return NextResponse.json({
    profiles: vehicleId ? profiles.filter((profile) => profile.vehicleId === vehicleId) : profiles,
    vehicles: vehicleRows,
    routes: routeRows,
    locations: locationRows,
  });
}

/** Formula profiles accept TRY kuruş only. New records are created only through the explicit create flow. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = profileSchema.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: data.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  const [{ db }, { auditLogs, vehiclePricingProfiles, vehicles }, { and, eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);
  const [vehicle] = await db.select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.id, data.data.vehicleId))
    .limit(1);
  if (!vehicle) return NextResponse.json({ error: 'Araç bulunamadı.' }, { status: 404 });
  const [profile] = await db.transaction(async (tx) => {
    // Keep only the newest active version within this vehicle + mode pair.
    // DISTANCE and HOURLY are independent and may both remain active.
    await tx.update(vehiclePricingProfiles).set({
      active: false,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(and(
      eq(vehiclePricingProfiles.vehicleId, data.data.vehicleId),
      eq(vehiclePricingProfiles.mode, data.data.mode),
      eq(vehiclePricingProfiles.active, true),
    ));
    await tx.update(vehicles).set({
      priceCalculationEligible: true,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(eq(vehicles.id, data.data.vehicleId));
    return tx.insert(vehiclePricingProfiles).values({
      ...data.data,
      validFrom: null,
      validUntil: null,
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();
  });
  await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'CREATE', entityType: 'VehiclePricingProfile', entityId: profile.id, metadata: { vehicleId: profile.vehicleId, mode: profile.mode } }).catch(() => {});
  return NextResponse.json({ item: profile }, { status: 201 });
}

/** Edits a formula in place without creating or deactivating another version. */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = z.object({ id: z.string().uuid() }).and(profileSchema)
    .safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  const [{ db }, { auditLogs, vehiclePricingProfiles }, { eq }] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
  ]);
  const [existing] = await db.select({
    id: vehiclePricingProfiles.id,
    vehicleId: vehiclePricingProfiles.vehicleId,
    mode: vehiclePricingProfiles.mode,
  }).from(vehiclePricingProfiles)
    .where(eq(vehiclePricingProfiles.id, payload.data.id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Formül bulunamadı.' }, { status: 404 });
  if (existing.vehicleId !== payload.data.vehicleId || existing.mode !== payload.data.mode) {
    return NextResponse.json(
      { error: 'Düzenleme sırasında araç veya hesaplama modu değiştirilemez.' },
      { status: 409 },
    );
  }

  const values = payload.data.mode === 'DISTANCE'
    ? {
        active: payload.data.active,
        notes: payload.data.notes ?? null,
        distanceOpeningKurus: payload.data.distanceOpeningKurus,
        distanceFirstKmKurus: payload.data.distanceFirstKmKurus,
        distanceThresholdKm: payload.data.distanceThresholdKm,
        distanceSecondKmKurus: payload.data.distanceSecondKmKurus,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      }
    : {
        active: payload.data.active,
        notes: payload.data.notes ?? null,
        hourlyRateKurus: payload.data.hourlyRateKurus,
        minimumHours: payload.data.minimumHours,
        includedKmMode: payload.data.includedKmMode,
        includedKm: payload.data.includedKm,
        excessKmKurus: payload.data.excessKmKurus,
        excessHourKurus: payload.data.excessHourKurus,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      };

  const [item] = await db.update(vehiclePricingProfiles)
    .set(values)
    .where(eq(vehiclePricingProfiles.id, existing.id))
    .returning();
  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'UPDATE',
    entityType: 'VehiclePricingProfile',
    entityId: item.id,
    metadata: { vehicleId: item.vehicleId, mode: item.mode },
  }).catch(() => {});
  return NextResponse.json({ item });
}

/** Deactivation preserves historic formula references and makes new calculations fail closed. */
export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: 'Geçersiz profil işlemi.' }, { status: 422 });
  const [{ db }, { vehiclePricingProfiles }, { and, eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);
  const item = await db.transaction(async (tx) => {
    const [profile] = await tx.select({
      id: vehiclePricingProfiles.id,
      vehicleId: vehiclePricingProfiles.vehicleId,
      mode: vehiclePricingProfiles.mode,
    }).from(vehiclePricingProfiles).where(eq(vehiclePricingProfiles.id, payload.data.id)).limit(1);
    if (!profile) return null;
    if (payload.data.active) {
      await tx.update(vehiclePricingProfiles).set({
        active: false,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      }).where(and(
        eq(vehiclePricingProfiles.vehicleId, profile.vehicleId),
        eq(vehiclePricingProfiles.mode, profile.mode),
        eq(vehiclePricingProfiles.active, true),
      ));
    }
    const [updated] = await tx.update(vehiclePricingProfiles).set({
      active: payload.data.active,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(eq(vehiclePricingProfiles.id, profile.id)).returning();
    return updated;
  });
  if (!item) return NextResponse.json({ error: 'Profil bulunamadı.' }, { status: 404 });
  return NextResponse.json({ item });
}

/** Permanently removes an unused formula version. Vehicle/quote history is not touched. */
export async function DELETE(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'));
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz formül kimliği.' }, { status: 422 });

  const [{ db }, { auditLogs, vehiclePricingProfiles }, { eq }] = await Promise.all([
    import('@/db'), import('@/db/schema'), import('drizzle-orm'),
  ]);
  try {
    const [deleted] = await db.delete(vehiclePricingProfiles)
      .where(eq(vehiclePricingProfiles.id, parsed.data))
      .returning({ id: vehiclePricingProfiles.id, vehicleId: vehiclePricingProfiles.vehicleId, mode: vehiclePricingProfiles.mode });
    if (!deleted) return NextResponse.json({ error: 'Formül bulunamadı.' }, { status: 404 });
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'VehiclePricingProfile',
      entityId: deleted.id,
      metadata: { vehicleId: deleted.vehicleId, mode: deleted.mode },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vehicle pricing profile delete error:', error);
    return NextResponse.json({ error: 'Bu formül bağımlı bir kayıt nedeniyle silinemedi. Formülü pasife almayı deneyin.' }, { status: 409 });
  }
}