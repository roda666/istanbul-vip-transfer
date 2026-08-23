/**
 * The public fleet taxonomy is deliberately application-level rather than a
 * database enum: existing installations have free-text values, while all new
 * admin input is constrained to this single shared allowlist.
 */
export const VEHICLE_TYPE_OPTIONS = [
  { value: 'minivan', label: 'Minivan' },
  { value: 'minibus', label: 'Minibüs' },
  { value: 'midibus', label: 'Midibüs' },
  { value: 'bus', label: 'Otobüs' },
] as const;

export type VehicleType = (typeof VEHICLE_TYPE_OPTIONS)[number]['value'];

export const VEHICLE_TYPE_VALUES = VEHICLE_TYPE_OPTIONS.map((option) => option.value) as [
  VehicleType,
  ...VehicleType[],
];

export function isVehicleType(value: string | null | undefined): value is VehicleType {
  return !!value && VEHICLE_TYPE_VALUES.includes(value as VehicleType);
}

/** Normalizes legacy uppercase records while the data restructure converges. */
export function normalizeVehicleType(value: string | null | undefined): VehicleType | null {
  const normalized = value?.trim().toLowerCase();
  return isVehicleType(normalized) ? normalized : null;
}

export const FLEET_GROUP_ORDER: VehicleType[] = ['minivan', 'minibus', 'midibus', 'bus'];

export function groupFleetVehicles<T extends { vehicleType: string | null; passengerCapacity: number | null }>(
  vehicles: T[],
): Array<{ type: VehicleType; vehicles: T[] }> {
  return FLEET_GROUP_ORDER.map((type) => ({
    type,
    vehicles: vehicles
      .filter((vehicle) => normalizeVehicleType(vehicle.vehicleType) === type)
      .sort((a, b) => (a.passengerCapacity ?? Infinity) - (b.passengerCapacity ?? Infinity)),
  })).filter((group) => group.vehicles.length > 0);
}