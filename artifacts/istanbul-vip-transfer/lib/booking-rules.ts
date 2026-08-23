/** Shared public booking constraints used by the browser form and API route. */

/** Largest published fleet vehicle currently seats 45 passengers. */
export const MAX_PASSENGERS = 45;
export const MIN_ALLOCATION_HOURS = 4;
export const FIVE_MINUTE_VALUES = new Set([
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55',
]);

export function isValidPassengerCount(value: string | number): boolean {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= MAX_PASSENGERS;
}

export interface CapacityVehicle {
  passengerCapacity: number | null;
}

/** Returns the smallest real published vehicle that can safely carry the group. */
export function findSmallestFittingVehicle<T extends CapacityVehicle>(
  vehicles: T[],
  passengers: string | number,
): T | null {
  const count = Number(passengers);
  if (!isValidPassengerCount(count)) return null;
  return vehicles
    .filter((vehicle) => (vehicle.passengerCapacity ?? 0) >= count)
    .sort((a, b) => (a.passengerCapacity ?? Infinity) - (b.passengerCapacity ?? Infinity))[0] ?? null;
}

export function isFiveMinuteIncrement(value: string): boolean {
  return FIVE_MINUTE_VALUES.has(value);
}

export function meetsAllocationMinimum(
  duration: string | number,
  unit: 'SAAT' | 'GUN' | string,
): boolean {
  const numericDuration = Number(duration);
  if (!Number.isFinite(numericDuration) || numericDuration <= 0) return false;
  return unit !== 'SAAT' || numericDuration >= MIN_ALLOCATION_HOURS;
}