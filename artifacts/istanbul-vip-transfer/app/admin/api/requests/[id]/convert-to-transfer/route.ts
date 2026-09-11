import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const schema = z.object({
  plannedPickupAt: z.string().datetime(),
  pickupLocationSummary: z.string().trim().min(1).max(500),
  dropoffLocationSummary: z.string().trim().min(1).max(500),
  routeSummary: z.string().trim().min(1).max(1000),
  customerSummary: z.string().trim().min(1).max(500),
  vehicleId: z.string().uuid().nullable().optional(),
  driverId: z.string().uuid().nullable().optional(),
});
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin; try { admin = await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const data = schema.safeParse(await req.json().catch(() => null)); if (!data.success) return NextResponse.json({ error: 'Transfer tarihi ve açık rota/konum özeti zorunludur.' }, { status: 422 });
  try {
    const { db } = await import('@/db'); const { reservationRequests, transferOperations, drivers, vehicles, auditLogs } = await import('@/db/schema'); const { eq, and, or, gte, lte, notInArray, sql } = await import('drizzle-orm');
    const requestId = (await params).id;
    const [item] = await db.transaction(async (tx) => {
      const [request] = await tx.select({ id: reservationRequests.id }).from(reservationRequests).where(eq(reservationRequests.id, requestId));
      if (!request) throw new Error('REQUEST_NOT_FOUND');
      for (const resource of [data.data.driverId, data.data.vehicleId].filter(Boolean).sort()) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${resource!}))`);
      if (data.data.driverId) { const [d] = await tx.select({ active: drivers.isActive }).from(drivers).where(eq(drivers.id, data.data.driverId)); if (!d) throw new Error('DRIVER_NOT_FOUND'); if (!d.active) throw new Error('DRIVER_INACTIVE'); }
      if (data.data.vehicleId) { const [v] = await tx.select({ active: vehicles.isActive }).from(vehicles).where(eq(vehicles.id, data.data.vehicleId)); if (!v) throw new Error('VEHICLE_NOT_FOUND'); if (!v.active) throw new Error('VEHICLE_INACTIVE'); }
      const pickup = new Date(data.data.plannedPickupAt), from = new Date(pickup.getTime() - 2 * 3600000), to = new Date(pickup.getTime() + 2 * 3600000);
      const resources = [data.data.driverId ? eq(transferOperations.driverId, data.data.driverId) : undefined, data.data.vehicleId ? eq(transferOperations.vehicleId, data.data.vehicleId) : undefined].filter(Boolean);
      if (resources.length) { const [collision] = await tx.select({ id: transferOperations.id }).from(transferOperations).where(and(or(...resources), notInArray(transferOperations.status, ['CANCELLED', 'COMPLETED']), gte(transferOperations.plannedPickupAt, from), lte(transferOperations.plannedPickupAt, to))).limit(1); if (collision) throw new Error('RESOURCE_CONFLICT'); }
      const [created] = await tx.insert(transferOperations).values({ requestId, ...data.data, plannedPickupAt: pickup, status: data.data.driverId ? 'ASSIGNED' : 'PLANNED', assignedAt: data.data.driverId ? new Date() : null, assignedBy: data.data.driverId ? admin.adminId : null, createdBy: admin.adminId, updatedBy: admin.adminId }).returning();
      await tx.insert(auditLogs).values({ adminUserId: admin.adminId, action: 'CREATE', entityType: 'transfer_operation', entityId: created.id, metadata: { source: 'reservation_request_conversion', requestId } });
      return [created];
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) { const message = String(e); if (message.includes('REQUEST_NOT_FOUND')) return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 }); if (message.includes('INACTIVE')) return NextResponse.json({ error: 'Pasif sürücü veya araç atanamaz.' }, { status: 409 }); if (message.includes('RESOURCE_CONFLICT')) return NextResponse.json({ error: 'Kaynak zaman aralığında başka aktif atama var.' }, { status: 409 }); if (message.includes('request_id')) return NextResponse.json({ error: 'Bu talep zaten transfere dönüştürülmüş.' }, { status: 409 }); return NextResponse.json({ error: 'Dönüştürme başarısız.' }, { status: 503 }); }
}