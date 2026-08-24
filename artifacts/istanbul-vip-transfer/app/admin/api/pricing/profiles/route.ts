import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
    db.select({ id: vehicles.id, name: vehicles.name, pricingClass: vehicles.pricingClass, priceCalculationEligible: vehicles.priceCalculationEligible, status: vehicles.status }).from(vehicles).orderBy(asc(vehicles.name)),
    db.select({
      id: transferRoutes.id, name: transferRoutes.name, originLocationId: transferRoutes.originLocationId,
      destinationLocationId: transferRoutes.destinationLocationId, defaultVehicleId: transferRoutes.defaultVehicleId,
      distanceKm: transferRoutes.distanceKm, distanceSource: transferRoutes.distanceSource, active: transferRoutes.active,
    }).from(transferRoutes).where(eq(transferRoutes.active, true)).orderBy(asc(transferRoutes.name)),
    db.select({ id: locations.id, name: locations.name, city: locations.city })
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

/** Formula profiles accept TRY kuruş only. Update is append-only from the UI: disable old, add new. */
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
  const [vehicle] = await db.select({
    id: vehicles.id,
    priceCalculationEligible: vehicles.priceCalculationEligible,
  }).from(vehicles).where(eq(vehicles.id, data.data.vehicleId)).limit(1);
  if (!vehicle) return NextResponse.json({ error: 'Araç bulunamadı.' }, { status: 404 });
  if (!vehicle.priceCalculationEligible) {
    return NextResponse.json({ error: 'Bu araç fiyat hesaplamasına dahil değil.' }, { status: 422 });
  }
  const [profile] = await db.transaction(async (tx) => {
    // A new formula takes effect immediately. Prior versions remain auditable
    // but become inactive, so no date window is needed to select one.
    await tx.update(vehiclePricingProfiles).set({
      active: false,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(and(
      eq(vehiclePricingProfiles.vehicleId, data.data.vehicleId),
      eq(vehiclePricingProfiles.mode, data.data.mode),
      eq(vehiclePricingProfiles.active, true),
    ));
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