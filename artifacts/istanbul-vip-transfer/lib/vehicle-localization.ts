/**
 * Public vehicle localization rules shared by the API and server-rendered
 * vehicle schema. Do not fall back to Turkish source fields for non-Turkish
 * visitors: incomplete cards are withheld until their translation is ready.
 */
export const LOCALIZED_FEATURE_CODES = new Set([
  'WIFI',
  'CLIMATE',
  'MEET_GREET',
  'LEATHER',
  'LUXURY',
  'WATER',
]);

type Feature = { icon?: string; label?: string } | string;

export interface LocalizableVehicle {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  fullDescription?: string | null;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  vehicleType: string | null;
  features: Feature[] | null;
  coverImage: string | null;
  isFeatured: boolean;
  displayOrder: number;
  nameTranslations: Record<string, string> | null;
  shortDescTranslations: Record<string, string> | null;
  taglineTranslations: Record<string, string> | null;
}

export interface ResolvedPublicVehicle {
  id: string;
  slug: string;
  passengerCapacity: number | null;
  luggageCapacity: number | null;
  vehicleType: string | null;
  features: Feature[];
  coverImage: string | null;
  coverImageAlt: string;
  isFeatured: boolean;
  displayOrder: number;
  displayName: string;
  displayShortDesc: string;
  displayTagline: string;
}

function nonEmpty(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function featureCode(feature: Feature): string | null {
  return typeof feature === 'string' ? feature : feature.icon ?? null;
}

export function resolvePublicVehicle(
  vehicle: LocalizableVehicle,
  locale: string,
): ResolvedPublicVehicle | null {
  const isTurkish = locale === 'tr';
  const displayName = nonEmpty(
    isTurkish ? vehicle.nameTranslations?.tr ?? vehicle.name : vehicle.nameTranslations?.[locale],
  );
  const displayShortDesc = nonEmpty(
    isTurkish
      ? vehicle.shortDescTranslations?.tr ?? vehicle.shortDescription
      : vehicle.shortDescTranslations?.[locale],
  );
  const displayTagline = nonEmpty(
    isTurkish ? vehicle.taglineTranslations?.tr : vehicle.taglineTranslations?.[locale],
  );

  if (!displayName || !displayShortDesc || !displayTagline) return null;

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    passengerCapacity: vehicle.passengerCapacity,
    luggageCapacity: vehicle.luggageCapacity,
    vehicleType: vehicle.vehicleType,
    features: (vehicle.features ?? []).filter((feature) => (
      isTurkish || LOCALIZED_FEATURE_CODES.has(featureCode(feature) ?? '')
    )),
    coverImage: vehicle.coverImage,
    // There is no localized alt-text field. The localized vehicle name is the
    // safe, meaningful alternative to a potentially Turkish source alt text.
    coverImageAlt: displayName,
    isFeatured: vehicle.isFeatured,
    displayOrder: vehicle.displayOrder,
    displayName,
    displayShortDesc,
    displayTagline,
  };
}