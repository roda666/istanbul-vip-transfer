/** Shared public booking constraints used by the browser form and API route. */

export const MAX_PASSENGERS = 30;
export const MIN_ALLOCATION_HOURS = 4;
export const FIVE_MINUTE_VALUES = new Set([
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55',
]);

export function isValidPassengerCount(value: string | number): boolean {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= MAX_PASSENGERS;
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