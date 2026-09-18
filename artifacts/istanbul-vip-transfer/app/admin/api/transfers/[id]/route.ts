import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
const schema = z.object({ driverId: z.string().uuid().nullable().optional(), vehicleId: z.string().uuid().nullable().optional(), status: z.enum(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional() });
async function auth() { try { return await (await import('@/lib/auth/session')).requireAdminSession(); } catch { return null; } }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await auth(); if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Geçersiz güncelleme.' }, { status: 422 });
  try {
    const { db } = await import('@/db'); const { transferOperations, drivers, vehicles, transferAssignmentAudits, auditLogs } = await import('@/db/schema'); const { eq, and, or, ne, gte, lte, notInArray, sql } = await import('drizzle-orm');
    const id = (await params).id; const next = parsed.data;
    const [item] = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(transferOperations).where(eq(transferOperations.id, id));
      if (!current) throw new Error('NOT_FOUND');
      const assignedDriver = next.driverId === undefined ? current.driverId : next.driverId;
      const assignedVehicle = next.vehicleId === undefined ? current.vehicleId : next.vehicleId;
      for (const resource of [assignedDriver, assignedVehicle].filter(Boolean).sort()) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${resource!}))`);
      if (assignedDriver) { const [d] = await tx.select({ active: drivers.isActive }).from(drivers).where(eq(drivers.id, assignedDriver)); if (!d) throw new Error('DRIVER_NOT_FOUND'); if (!d.active) throw new Error('DRIVER_INACTIVE'); }
      if (assignedVehicle) { const [v] = await tx.select({ active: vehicles.isActive }).from(vehicles).where(eq(vehicles.id, assignedVehicle)); if (!v) throw new Error('VEHICLE_NOT_FOUND'); if (!v.active) throw new Error('VEHICLE_INACTIVE'); }
      const at = current.plannedPickupAt, from = new Date(at.getTime() - 2 * 3600000), to = new Date(at.getTime() + 2 * 3600000);
      const resources = [assignedDriver ? eq(transferOperations.driverId, assignedDriver) : undefined, assignedVehicle ? eq(transferOperations.vehicleId, assignedVehicle) : undefined].filter(Boolean);
      if (resources.length) {
        const [collision] = await tx.select({ id: transferOperations.id }).from(transferOperations).where(and(or(...resources), ne(transferOperations.id, id), notInArray(transferOperations.status, ['CANCELLED', 'COMPLETED']), gte(transferOperations.plannedPickupAt, from), lte(transferOperations.plannedPickupAt, to))).limit(1);
        if (collision) throw new Error('RESOURCE_CONFLICT');
      }
      const status = next.status ?? current.status;
      if ((current.status === 'COMPLETED' || current.status === 'CANCELLED') && (next.driverId !== undefined || next.vehicleId !== undefined)) throw new Error('TERMINAL_ASSIGNMENT');
      const transitions: Record<string, string[]> = { PLANNED: ['PLANNED', 'ASSIGNED', 'CANCELLED'], ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'], COMPLETED: ['COMPLETED'], CANCELLED: ['CANCELLED'] };
      if (next.status && !transitions[current.status]?.includes(next.status)) throw new Error('INVALID_TRANSITION');
      if ((status === 'ASSIGNED' || status === 'IN_PROGRESS') && !assignedDriver) throw new Error('STATUS_ASSIGNMENT');
      if (status === 'PLANNED' && assignedDriver) throw new Error('STATUS_ASSIGNMENT');
      const [updated] = await tx.update(transferOperations).set({ ...next, status, assignedAt: assignedDriver && !current.driverId ? new Date() : current.assignedAt, assignedBy: assignedDriver && !current.driverId ? admin.adminId : current.assignedBy, unassignedAt: !assignedDriver && current.driverId ? new Date() : current.unassignedAt, unassignedBy: !assignedDriver && current.driverId ? admin.adminId : current.unassignedBy, updatedAt: new Date(), updatedBy: admin.adminId }).where(eq(transferOperations.id, id)).returning();
      if (next.driverId !== undefined || next.vehicleId !== undefined) await tx.insert(transferAssignmentAudits).values({ transferOperationId: id, action: assignedDriver ? 'ASSIGNED' : 'UNASSIGNED', previousDriverId: current.driverId, driverId: assignedDriver, previousVehicleId: current.vehicleId, vehicleId: assignedVehicle, adminUserId: admin.adminId, metadata: {} });
      const statusChanged = next.status !== undefined && next.status !== current.status;
      await tx.insert(auditLogs).values({
        adminUserId: admin.adminId,
        action: statusChanged && next.status === 'CANCELLED' ? 'CANCEL' : 'UPDATE',
        entityType: 'transfer_operation',
        entityId: id,
        metadata: {
          fields: Object.keys(next),
          ...(statusChanged ? { from: current.status, to: next.status } : {}),
        },
      });
      return [updated];
    });
    return NextResponse.json({ item });
   } catch (e) { const message = String(e); if (message.includes('NOT_FOUND')) return NextResponse.json({ error: 'Transfer bulunamadı.' }, { status: 404 }); if (message.includes('INACTIVE') || message.includes('STATUS_ASSIGNMENT') || message.includes('TERMINAL_ASSIGNMENT') || message.includes('INVALID_TRANSITION')) return NextResponse.json({ error: 'Atama veya durum geçişi geçersiz.' }, { status: 409 }); if (message.includes('RESOURCE_CONFLICT')) return NextResponse.json({ error: 'Kaynak zaman aralığında başka aktif atama var.' }, { status: 409 }); return NextResponse.json({ error: 'Transfer güncellenemedi.' }, { status: 503 }); }
}