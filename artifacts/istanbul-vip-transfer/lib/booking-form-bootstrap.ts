import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from '@/db';
import {
  customReservationFields,
  locations,
  serviceTypes,
  siteSettings,
  vehicles,
} from '@/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getVehicleFeatureDefaults } from '@/lib/vehicle-feature-defaults-server';
import { resolvePublishedVehicles } from '@/lib/vehicle-localization';
import {
  EMPTY_BOOKING_FORM_BOOTSTRAP,
  FALLBACK_BOOKING_SERVICE_TYPES,
  type BookingFormBootstrap,
  type BookingLocationOption,
} from '@/lib/booking-form-types';

export const BOOKING_FORM_BOOTSTRAP_TAG = 'public-booking-form-bootstrap';

function sortLocations(rows: BookingLocationOption[], scope: 'local' | 'intercity') {
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    const rank = (row: BookingLocationOption) => {
      if (scope === 'intercity') return row.type === 'PROVINCE' ? 1 : 0;
      if (row.type === 'AIRPORT') return 0;
      if (row.type === 'DISTRICT') return 1;
      if (row.type === 'REGION') return 2;
      return 3;
    };
    return rank(a) - rank(b) || collator.compare(a.name, b.name);
  });
}

const getCachedBookingFormBootstrap = unstable_cache(
  async (lang: string): Promise<BookingFormBootstrap> => {
    const [serviceRows, locationRows, vehicleRows, settingRows, customFieldRows, defaultFeatureCodes] =
      await Promise.all([
        db.select({
          id: serviceTypes.id,
          key: serviceTypes.key,
          label: serviceTypes.label,
          description: serviceTypes.description,
          quoteEnabled: serviceTypes.quoteEnabled,
          reservationEnabled: serviceTypes.reservationEnabled,
        }).from(serviceTypes).where(eq(serviceTypes.enabled, true)).orderBy(asc(serviceTypes.displayOrder)),
        db.select({
          id: locations.id,
          name: locations.name,
          slug: locations.slug,
          type: locations.type,
          scope: locations.scope,
          city: locations.city,
          district: locations.district,
          pickupEnabled: locations.pickupEnabled,
          dropoffEnabled: locations.dropoffEnabled,
        }).from(locations)
          .where(and(isNull(locations.archivedAt), eq(locations.isActive, true)))
          .orderBy(asc(locations.displayOrder), asc(locations.name)),
        db.select({
          id: vehicles.id,
          name: vehicles.name,
          slug: vehicles.slug,
          shortDescription: vehicles.shortDescription,
          passengerCapacity: vehicles.passengerCapacity,
          luggageCapacity: vehicles.luggageCapacity,
          vehicleType: vehicles.vehicleType,
          features: vehicles.features,
          coverImage: vehicles.coverImage,
          coverImageAlt: vehicles.coverImageAlt,
          isFeatured: vehicles.isFeatured,
          displayOrder: vehicles.displayOrder,
          nameTranslations: vehicles.nameTranslations,
          shortDescTranslations: vehicles.shortDescTranslations,
          taglineTranslations: vehicles.taglineTranslations,
        }).from(vehicles)
          .where(and(eq(vehicles.status, 'PUBLISHED'), eq(vehicles.isActive, true)))
          .orderBy(asc(vehicles.displayOrder)),
        db.select({ showVehiclePreference: siteSettings.showVehiclePreference })
          .from(siteSettings).where(eq(siteSettings.id, 1)).limit(1),
        db.select().from(customReservationFields)
          .where(eq(customReservationFields.isActive, true))
          .orderBy(asc(customReservationFields.sortOrder), asc(customReservationFields.id)),
        getVehicleFeatureDefaults(),
      ]);

    const localRows = locationRows.filter((row) =>
      row.city === 'İstanbul' && (row.scope === 'LOCAL' || row.scope === 'BOTH'));
    const intercityRows = locationRows.filter((row) =>
      (row.scope === 'INTERCITY' || row.scope === 'BOTH')
      && (row.type === 'PROVINCE' || row.city === 'İstanbul'));
    const toPublicLocation = ({
      pickupEnabled: _pickupEnabled,
      dropoffEnabled: _dropoffEnabled,
      ...row
    }: (typeof locationRows)[number]): BookingLocationOption => row;

    const resolvedVehicles = resolvePublishedVehicles(vehicleRows, lang, defaultFeatureCodes);

    return {
      serviceTypes: serviceRows.length ? serviceRows : FALLBACK_BOOKING_SERVICE_TYPES,
      vehicles: resolvedVehicles.map((vehicle) => ({
        id: vehicle.id,
        slug: vehicle.slug,
        displayName: vehicle.displayName,
        passengerCapacity: vehicle.passengerCapacity,
        vehicleType: vehicle.vehicleType,
      })),
      formSettings: {
        showVehiclePreference: settingRows[0]?.showVehiclePreference === true,
      },
      customFields: customFieldRows.map((field) => ({
        id: field.id,
        label: field.label,
        appliesToSlugs: (field.appliesToSlugs as string[] | null) ?? [],
        fieldType: field.fieldType,
        isActive: field.isActive,
        sortOrder: field.sortOrder,
      })),
      locations: {
        localPickup: sortLocations(localRows.filter((row) => row.pickupEnabled).map(toPublicLocation), 'local'),
        localDropoff: sortLocations(localRows.filter((row) => row.dropoffEnabled).map(toPublicLocation), 'local'),
        intercityPickup: sortLocations(intercityRows.filter((row) => row.pickupEnabled).map(toPublicLocation), 'intercity'),
        intercityDropoff: sortLocations(intercityRows.filter((row) => row.dropoffEnabled).map(toPublicLocation), 'intercity'),
      },
    };
  },
  ['booking-form-bootstrap'],
  { revalidate: 300, tags: [BOOKING_FORM_BOOTSTRAP_TAG] },
);

export async function getBookingFormBootstrap(lang: string): Promise<BookingFormBootstrap> {
  try {
    return await getCachedBookingFormBootstrap(lang);
  } catch (error) {
    console.error('Booking form bootstrap error:', error);
    return EMPTY_BOOKING_FORM_BOOTSTRAP;
  }
}

export function revalidateBookingFormBootstrap(): void {
  revalidateTag(BOOKING_FORM_BOOTSTRAP_TAG);
}