export type ScheduledTransfer = { id: string; plannedPickupAt: string; driverId: string | null };

export function selectNextTransfer<T extends ScheduledTransfer>(items: T[], now: Date): T | null {
  return items.filter(item => new Date(item.plannedPickupAt).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.plannedPickupAt).getTime() - new Date(b.plannedPickupAt).getTime())[0] ?? null;
}

export function formatTransferCountdown(pickupAt: string | null, now: Date): string {
  if (!pickupAt) return 'Planlanmış sonraki transfer yok';
  const seconds = Math.max(0, Math.floor((new Date(pickupAt).getTime() - now.getTime()) / 1000));
  return seconds < 60 ? `${seconds} sn kaldı` : `${Math.floor(seconds / 3600)} sa ${Math.floor((seconds % 3600) / 60)} dk kaldı`;
}

export function isAssignmentOverlapping(pickupAt: Date, otherPickups: Date[], windowMinutes = 120): boolean {
  return otherPickups.some(other => Math.abs(other.getTime() - pickupAt.getTime()) < windowMinutes * 60_000);
}

export function canAssignDriver(input: { driverActive: boolean; pickupAt: Date; otherPickups: Date[] }): { ok: true } | { ok: false; reason: 'INACTIVE_DRIVER' | 'OVERLAPPING_ASSIGNMENT' } {
  if (!input.driverActive) return { ok: false, reason: 'INACTIVE_DRIVER' };
  if (isAssignmentOverlapping(input.pickupAt, input.otherPickups)) return { ok: false, reason: 'OVERLAPPING_ASSIGNMENT' };
  return { ok: true };
}

export type AssignmentCandidate = { driverId: string | null; vehicleId: string | null; status: string; plannedPickupAt: Date };

/** Mirrors the server collision rule: either resource matching is a collision. */
export function hasResourceCollision(candidate: AssignmentCandidate, existing: AssignmentCandidate[], windowMinutes = 120): boolean {
  return existing.some(item =>
    item.status !== 'CANCELLED' &&
    item.status !== 'COMPLETED' &&
    (Boolean(candidate.driverId && item.driverId === candidate.driverId) || Boolean(candidate.vehicleId && item.vehicleId === candidate.vehicleId)) &&
    isAssignmentOverlapping(candidate.plannedPickupAt, [item.plannedPickupAt], windowMinutes),
  );
}

export const TRANSFER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  PLANNED: ['PLANNED', 'ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
};

export function isTransferStatusTransitionValid(current: string, next: string): boolean {
  return TRANSFER_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}