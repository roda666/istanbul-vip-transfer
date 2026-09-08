/**
 * The public fleet taxonomy is deliberately application-level rather than a
 * database enum: existing installations have free-text values, while all new
 * admin input is constrained to this single shared allowlist.
 */
export const VEHICLE_TYPE_OPTIONS = [
  { value: 'automobile', label: 'Otomobil' },
  { value: 'minibus', label: 'Minibüs' },
  { value: 'midibus', label: 'Midibüs' },
  { value: 'bus', label: 'Otobüs' },
] as const;

/** `minivan` is intentionally accepted for pre-existing vehicle records/API clients. */
export const VEHICLE_TYPE_VALUES = ['automobile', 'minibus', 'midibus', 'bus', 'minivan'] as const;
export type VehicleType = (typeof VEHICLE_TYPE_VALUES)[number];

export function isVehicleType(value: string | null | undefined): value is VehicleType {
  return !!value && VEHICLE_TYPE_VALUES.includes(value as VehicleType);
}

/** Normalizes legacy uppercase records while the data restructure converges. */
export function normalizeVehicleType(value: string | null | undefined): VehicleType | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'minivan') return 'automobile';
  return isVehicleType(normalized) ? normalized : null;
}

export const FLEET_GROUP_ORDER: VehicleType[] = ['automobile', 'minibus', 'midibus', 'bus'];

/**
 * A suggested starting class only. It is never a replacement for an existing
 * operator-specific vehicle_toll_point_classes assignment.
 */
export function defaultTollVehicleClassForType(value: string | null | undefined): 'class_1' | 'class_2' | 'class_3' | null {
  switch (normalizeVehicleType(value)) {
    case 'automobile': return 'class_1';
    case 'minibus':
    case 'midibus': return 'class_2';
    case 'bus': return 'class_3';
    default: return null;
  }
}

/** Mercedes Vito and Sprinter are class_2 panel defaults even in legacy data that calls them minivans. */
export function defaultTollVehicleClassForVehicle(
  vehicleType: string | null | undefined,
  vehicleName: string | null | undefined,
): 'class_1' | 'class_2' | 'class_3' | null {
  if (/\b(vito|sprinter)\b/i.test(vehicleName ?? '')) return 'class_2';
  return defaultTollVehicleClassForType(vehicleType);
}

/** Compares a ban to a stored fleet type while treating the old minivan code as Otomobil. */
export function isVehicleTypeBanned(vehicleType: string | null | undefined, bannedTypes: readonly string[]): boolean {
  const normalizedVehicleType = normalizeVehicleType(vehicleType);
  return normalizedVehicleType != null && bannedTypes.some((bannedType) => normalizeVehicleType(bannedType) === normalizedVehicleType);
}

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