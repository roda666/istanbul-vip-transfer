export type VehiclePricingMode = 'DISTANCE' | 'HOURLY';

export type PricingProfileSummary = {
  mode: VehiclePricingMode;
  active: boolean;
};

/**
 * The profiles API returns newest rows first. Keep the latest saved formula for
 * each mode in the editor, independently from the one formula currently active.
 */
export function selectPricingProfilesForEditor<T extends PricingProfileSummary>(profiles: T[]) {
  const byMode: Record<VehiclePricingMode, T | null> = {
    DISTANCE: null,
    HOURLY: null,
  };

  for (const profile of profiles) {
    if (!byMode[profile.mode]) byMode[profile.mode] = profile;
  }

  const active = profiles.find((profile) => profile.active) ?? null;
  return {
    byMode,
    active,
    selectedMode: active?.mode ?? profiles[0]?.mode ?? 'DISTANCE',
  } satisfies {
    byMode: Record<VehiclePricingMode, T | null>;
    active: T | null;
    selectedMode: VehiclePricingMode;
  };
}