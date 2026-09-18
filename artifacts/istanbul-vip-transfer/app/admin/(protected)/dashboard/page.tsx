import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import DashboardOperations from './_DashboardOperations';
import { getIstanbulDayBounds } from '@/lib/istanbul-time';

export const metadata: Metadata = { title: 'Dashboard | Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export type DashboardTransfer = {
  id: string; plannedPickupAt: string; pickupLocationSummary: string; dropoffLocationSummary: string;
  routeSummary: string; customerSummary: string; status: string; driverId: string | null;
  driverName: string | null; vehicleName: string | null;
};
export type DashboardData = {
  today: DashboardTransfer[]; tomorrowCount: number; quoteCount: number; unassignedCount: number;
  nextPickupAt: string | null; error: string | null;
};

async function loadDashboard(): Promise<DashboardData> {
  const today = getIstanbulDayBounds(0), tomorrow = getIstanbulDayBounds(1);
  try {
    const { db } = await import('@/db');
     const { transferOperations, drivers, vehicles, reservationRequests } = await import('@/db/schema');
    const { and, asc, count, eq, gte, isNull, lt, ne } = await import('drizzle-orm');
     const active = and(ne(transferOperations.status, 'CANCELLED'), ne(transferOperations.status, 'COMPLETED'));
     const [todayRows, tomorrowRows, unassigned, quotes] = await Promise.all([
       db.select({
         id: transferOperations.id,
         plannedPickupAt: transferOperations.plannedPickupAt,
         pickupLocationSummary: transferOperations.pickupLocationSummary,
         dropoffLocationSummary: transferOperations.dropoffLocationSummary,
         routeSummary: transferOperations.routeSummary,
         customerSummary: transferOperations.customerSummary,
         status: transferOperations.status,
         driverId: transferOperations.driverId,
         driverName: drivers.name,
         vehicleName: vehicles.name,
       })
        .from(transferOperations).leftJoin(drivers, eq(transferOperations.driverId, drivers.id))
        .leftJoin(vehicles, eq(transferOperations.vehicleId, vehicles.id))
        .where(and(active, gte(transferOperations.plannedPickupAt, today.start), lt(transferOperations.plannedPickupAt, today.end)))
        .orderBy(asc(transferOperations.plannedPickupAt)),
      db.select({ count: count() }).from(transferOperations).where(and(active, gte(transferOperations.plannedPickupAt, tomorrow.start), lt(transferOperations.plannedPickupAt, tomorrow.end))),
      db.select({ count: count() }).from(transferOperations).where(and(active, isNull(transferOperations.driverId))),
       db.select({ count: count() }).from(reservationRequests).where(and(isNull(reservationRequests.archivedAt), eq(reservationRequests.intent, 'QUOTE'), eq(reservationRequests.status, 'NEW'))),
    ]);
     const rows: DashboardTransfer[] = todayRows.map((row) => ({
       id: row.id, plannedPickupAt: row.plannedPickupAt.toISOString(), pickupLocationSummary: row.pickupLocationSummary,
       dropoffLocationSummary: row.dropoffLocationSummary, routeSummary: row.routeSummary, customerSummary: row.customerSummary,
       status: row.status, driverId: row.driverId, driverName: row.driverName, vehicleName: row.vehicleName,
    }));
    const now = Date.now(), next = rows.find(r => new Date(r.plannedPickupAt).getTime() >= now);
     return { today: rows, tomorrowCount: tomorrowRows[0]?.count ?? 0, quoteCount: quotes[0]?.count ?? 0, unassignedCount: unassigned[0]?.count ?? 0, nextPickupAt: next?.plannedPickupAt ?? null, error: null };
  } catch {
    return { today: [], tomorrowCount: 0, quoteCount: 0, unassignedCount: 0, nextPickupAt: null, error: 'Operasyon verileri yüklenemedi. Veritabanı şeması uygulanmamış olabilir.' };
  }
}

export default async function DashboardPage() {
  return <div style={{ padding: '28px 24px' }}><AdminPageHeader title="Dashboard" description="Günlük transfer operasyon merkezi" /><DashboardOperations initial={await loadDashboard()} /></div>;
}