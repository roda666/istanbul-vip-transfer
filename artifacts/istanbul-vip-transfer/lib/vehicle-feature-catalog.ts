/**
 * Fixed catalog of vehicle "ek özellik" (amenity) codes. This is the single
 * source of truth for which codes exist, their Turkish admin label, and their
 * canonical order — used by:
 *  - the admin fleet-wide defaults panel (which codes apply when a vehicle
 *    has none of its own),
 *  - the per-vehicle feature picker (admin can override for a real exception),
 *  - public rendering (icon + multi-language label lookup).
 *
 * Deliberately a fixed, small list rather than free text: only these codes
 * have real translations in every public language (see
 * lib/i18n dictionaries + VehicleFleet.tsx). A freeform label typed by an
 * admin can only ever be safely shown on the Turkish page (see
 * lib/vehicle-localization.ts), so keeping amenities on this catalog is what
 * lets them appear correctly for every visitor, not just Turkish ones.
 */
export const VEHICLE_FEATURE_CATALOG = [
  { code: 'WIFI', label: 'Wi-Fi' },
  { code: 'CLIMATE', label: 'İklimlendirme' },
  { code: 'MEET_GREET', label: 'Meet & Greet' },
  { code: 'LEATHER', label: 'Deri Koltuk' },
  { code: 'LUXURY', label: 'Lüks Donanım' },
  { code: 'WATER', label: 'İkram (Su/İçecek)' },
] as const;

export type VehicleFeatureCode = (typeof VEHICLE_FEATURE_CATALOG)[number]['code'];

export const VEHICLE_FEATURE_CODES: VehicleFeatureCode[] = VEHICLE_FEATURE_CATALOG.map((f) => f.code);

export function isVehicleFeatureCode(value: string): value is VehicleFeatureCode {
  return (VEHICLE_FEATURE_CODES as string[]).includes(value);
}

export function vehicleFeatureLabel(code: string): string {
  return VEHICLE_FEATURE_CATALOG.find((f) => f.code === code)?.label ?? code;
}

/** Sensible out-of-the-box default before an admin ever opens the settings panel. */
export const DEFAULT_VEHICLE_FEATURE_CODES: VehicleFeatureCode[] = ['WIFI', 'CLIMATE', 'MEET_GREET'];

export const PUBLIC_VEHICLE_LOCALES = ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
export type PublicVehicleLocale = (typeof PUBLIC_VEHICLE_LOCALES)[number];
export type CustomVehicleFeature = {
  code: `CUSTOM_${string}`;
  translations: Record<PublicVehicleLocale, string>;
};

export function isCustomVehicleFeature(value: unknown): value is CustomVehicleFeature {
  if (!value || typeof value !== 'object') return false;
  const feature = value as Partial<CustomVehicleFeature>;
  return typeof feature.code === 'string' && /^CUSTOM_[A-Za-z0-9_-]+$/.test(feature.code)
    && !!feature.translations && PUBLIC_VEHICLE_LOCALES.every((locale) =>
      typeof feature.translations?.[locale] === 'string' && feature.translations[locale].trim().length > 0);
}
