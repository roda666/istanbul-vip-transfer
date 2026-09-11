import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const createSchema = z.object({
  requestId: z.string().uuid().optional().nullable(),
  plannedPickupAt: z.string().datetime(),
  pickupLocationSummary: z.string().trim().min(1).max(500),
  dropoffLocationSummary: z.string().trim().min(1).max(500),
  routeSummary: z.string().trim().min(1).max(1000),
  customerSummary: z.string().trim().min(1).max(500),
  vehicleId: z.string().uuid().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  status: z.enum(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});
async function auth() { try { return await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return null; } }
export async function GET(req: NextRequest) {
  if (!await auth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const p = req.nextUrl.searchParams, status = p.get('status'), assigned = p.get('assigned'), date = p.get('date');
  try {
    const { db } = await import('@/db'); const { transferOperations, drivers, vehicles } = await import('@/db/schema');
    const { and, asc, eq, gte, lt, isNull } = await import('drizzle-orm');
    const conditions = [];
    if (status) conditions.push(eq(transferOperations.status, status as never));
    if (assigned === 'false') conditions.push(isNull(transferOperations.driverId));
    if (date) {
      const { getIstanbulDayBounds } = await import('@/lib/istanbul-time');
      const offset = date === 'tomorrow' ? 1 : 0;
      const bounds = date === 'today' || date === 'tomorrow' ? getIstanbulDayBounds(offset) : { start: new Date(`${date}T00:00:00+03:00`), end: new Date(new Date(`${date}T00:00:00+03:00`).getTime() + 86400000) };
      conditions.push(gte(transferOperations.plannedPickupAt, bounds.start), lt(transferOperations.plannedPickupAt, bounds.end));
    }
    const rows = await db.select({ transfer: transferOperations, driver: drivers, vehicle: vehicles }).from(transferOperations).leftJoin(drivers, eq(transferOperations.driverId, drivers.id)).leftJoin(vehicles, eq(transferOperations.vehicleId, vehicles.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(transferOperations.plannedPickupAt));
    return NextResponse.json({ items: rows.map(r => ({ ...r.transfer, driver: r.driver, vehicle: r.vehicle })) });
  } catch { return NextResponse.json({ error: 'Transferler yüklenemedi.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const admin = await auth(); if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz transfer.' }, { status: 422 });
  try {
    const { db } = await import('@/db'); const { transferOperations, drivers, vehicles, auditLogs } = await import('@/db/schema'); const { eq, and, or, gte, lte, notInArray, sql } = await import('drizzle-orm');
    const d = parsed.data;
    const pickup = new Date(d.plannedPickupAt);
    const [item] = await db.transaction(async (tx) => {
      // Advisory locks make the availability check and insert one atomic operation
      // for concurrent admins assigning the same resource.
      for (const resource of [d.driverId, d.vehicleId].filter(Boolean).sort()) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${resource!}))`);
      if (d.driverId) {
        const [driver] = await tx.select({ active: drivers.isActive }).from(drivers).where(eq(drivers.id, d.driverId));
        if (!driver) throw new Error('DRIVER_NOT_FOUND'); if (!driver.active) throw new Error('DRIVER_INACTIVE');
      }
      if (d.vehicleId) {
        const [vehicle] = await tx.select({ active: vehicles.isActive }).from(vehicles).where(eq(vehicles.id, d.vehicleId));
        if (!vehicle) throw new Error('VEHICLE_NOT_FOUND'); if (!vehicle.active) throw new Error('VEHICLE_INACTIVE');
      }
      const from = new Date(pickup.getTime() - 2 * 3600000), to = new Date(pickup.getTime() + 2 * 3600000);
      const status = d.status ?? (d.driverId ? 'ASSIGNED' : 'PLANNED');
      if ((status === 'ASSIGNED' || status === 'IN_PROGRESS') && !d.driverId) throw new Error('STATUS_ASSIGNMENT');
      if (status === 'PLANNED' && d.driverId) throw new Error('STATUS_ASSIGNMENT');
      const resources = [d.driverId ? eq(transferOperations.driverId, d.driverId) : undefined, d.vehicleId ? eq(transferOperations.vehicleId, d.vehicleId) : undefined].filter(Boolean);
      if (resources.length) {
        const [collision] = await tx.select({ id: transferOperations.id }).from(transferOperations).where(and(or(...resources), notInArray(transferOperations.status, ['CANCELLED', 'COMPLETED']), gte(transferOperations.plannedPickupAt, from), lte(transferOperations.plannedPickupAt, to))).limit(1);
        if (collision) throw new Error('RESOURCE_CONFLICT');
      }
      const [created] = await tx.insert(transferOperations).values({ ...d, plannedPickupAt: pickup, status, assignedAt: d.driverId ? new Date() : null, assignedBy: d.driverId ? admin.adminId : null, createdBy: admin.adminId, updatedBy: admin.adminId }).returning();
      await tx.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'CREATE', entityType: 'transfer_operation', entityId: created.id, metadata: {} });
      return [created];
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) { const message = String(e); if (message.includes('DRIVER_NOT_FOUND')) return NextResponse.json({ error: 'Sürücü bulunamadı.' }, { status: 404 }); if (message.includes('VEHICLE_NOT_FOUND')) return NextResponse.json({ error: 'Araç bulunamadı.' }, { status: 404 }); if (message.includes('INACTIVE') || message.includes('STATUS_ASSIGNMENT')) return NextResponse.json({ error: 'Pasif kaynak atanamaz veya atama durumu geçersiz.' }, { status: 409 }); if (message.includes('RESOURCE_CONFLICT')) return NextResponse.json({ error: 'Kaynak zaman aralığında başka aktif atama var.' }, { status: 409 }); if (message.includes('request_id')) return NextResponse.json({ error: 'Bu talep zaten transfere dönüştürülmüş.' }, { status: 409 }); return NextResponse.json({ error: 'Transfer oluşturulamadı.' }, { status: 503 }); }
}