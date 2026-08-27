/**
 * Public vehicle localization rules shared by the API and server-rendered
 * vehicle schema. Do not fall back to Turkish source fields for non-Turkish
 * visitors: incomplete cards are withheld until their translation is ready.
 */
import { VEHICLE_FEATURE_CODES } from '@/lib/vehicle-feature-catalog';

export const LOCALIZED_FEATURE_CODES = new Set<string>(VEHICLE_FEATURE_CODES);

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
  coverImageAlt?: string | null;
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

export function resolvePublishedVehicles<T extends LocalizableVehicle & { status?: string }>(
  vehicles: T[],
  locale: string,
  defaultFeatureCodes: string[] = [],
): ResolvedPublicVehicle[] {
  return vehicles.flatMap((vehicle) => {
    if (vehicle.status !== undefined && vehicle.status !== 'PUBLISHED') return [];
    const localized = resolvePublicVehicle(vehicle, locale, defaultFeatureCodes);
    return localized ? [localized] : [];
  });
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
  defaultFeatureCodes: string[] = [],
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

  // A fleet card must represent the actual vehicle. Do not substitute another
  // vehicle's image (historically Vito) when its own cover is absent.
  const coverImage = nonEmpty(vehicle.coverImage);
  const coverImageAlt = nonEmpty(vehicle.coverImageAlt);
  if (!displayName || !displayShortDesc || !displayTagline || !coverImage || !coverImageAlt) return null;

  // A vehicle's own features always win (a real, admin-set exception). Only
  // when nobody has configured anything for this vehicle does it inherit the
  // fleet-wide default list, so "no data" never reads as "this car has none".
  const ownFeatures = vehicle.features ?? [];
  const effectiveFeatures = ownFeatures.length > 0 ? ownFeatures : defaultFeatureCodes;

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    passengerCapacity: vehicle.passengerCapacity,
    luggageCapacity: vehicle.luggageCapacity,
    vehicleType: vehicle.vehicleType,
    features: effectiveFeatures.filter((feature) => (
      isTurkish || LOCALIZED_FEATURE_CODES.has(featureCode(feature) ?? '')
    )),
    coverImage,
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