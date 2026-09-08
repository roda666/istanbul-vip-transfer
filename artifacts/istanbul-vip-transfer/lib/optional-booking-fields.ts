export const OPTIONAL_BOOKING_FIELDS = [
  'showLuggageCount',
  'showChildSeatCount',
  'showVehiclePreference',
  'showAdditionalNotes',
] as const;

export type OptionalBookingField = (typeof OPTIONAL_BOOKING_FIELDS)[number];
export type OptionalFieldServiceTypeApplicability = Partial<Record<OptionalBookingField, string[]>>;

/** Older settings rows have no mapping; their enabled fields apply everywhere. */
export function appliesToServiceType(
  mapping: OptionalFieldServiceTypeApplicability | null | undefined,
  field: OptionalBookingField,
  serviceType: string,
): boolean {
  const selected = mapping?.[field];
  return selected === undefined || selected.includes(serviceType);
}