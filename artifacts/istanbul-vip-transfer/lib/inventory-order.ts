import { asc, desc } from 'drizzle-orm';
import { transferRoutes, vehicles } from '@/db/schema';

/**
 * The canonical ordering for vehicle and transfer-route collections.
 *
 * Keep the name and id tie-breakers in the database query rather than relying
 * on JavaScript's sort stability: displayOrder is intentionally editable and
 * is commonly shared by several records.
 */
export function vehicleDisplayOrder() {
  return [asc(vehicles.displayOrder), asc(vehicles.name), asc(vehicles.id)] as const;
}

export function transferRouteDisplayOrder() {
  return [asc(transferRoutes.displayOrder), asc(transferRoutes.name), asc(transferRoutes.id)] as const;
}

/**
 * Admin vehicle lists may explicitly request a different primary sort. The
 * canonical tie-breakers still make equal values deterministic.
 */
export function adminVehicleOrder(sort: 'displayOrder' | 'updatedAt', direction: 'asc' | 'desc') {
  const primary = direction === 'asc'
    ? asc(sort === 'displayOrder' ? vehicles.displayOrder : vehicles.updatedAt)
    : desc(sort === 'displayOrder' ? vehicles.displayOrder : vehicles.updatedAt);
  return [primary, asc(vehicles.name), asc(vehicles.id)] as const;
}
