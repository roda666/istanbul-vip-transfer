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
import { and, asc, eq, isNull, notInArray } from 'drizzle-orm';
import { getVehicleFeatureDefaults } from '@/lib/vehicle-feature-defaults-server';
import { resolvePublishedVehicles } from '@/lib/vehicle-localization';
import {
  EMPTY_BOOKING_FORM_INITIAL_DATA,
  EMPTY_BOOKING_FORM_OPTIONS,
  EMPTY_BOOKING_FORM_BOOTSTRAP,
  FALLBACK_BOOKING_SERVICE_TYPES,
  type BookingFormBootstrap,
  type BookingFormInitialData,
  type BookingLocationOption,
  type BookingFormOptions,
} from '@/lib/booking-form-types';
import { PUBLICLY_UNAVAILABLE_BOOKING_LOCATION_SLUGS } from '@/lib/booking-location-policy';

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

const getCachedBookingFormInitialData = unstable_cache(
  async (): Promise<BookingFormInitialData> => {
    const [serviceRows, settingRows, customFieldRows] = await Promise.all([
        db.select({
          id: serviceTypes.id,
          key: serviceTypes.key,
          label: serviceTypes.label,
          description: serviceTypes.description,
          quoteEnabled: serviceTypes.quoteEnabled,
          reservationEnabled: serviceTypes.reservationEnabled,
        }).from(serviceTypes).where(eq(serviceTypes.enabled, true)).orderBy(asc(serviceTypes.displayOrder)),
        db.select({ showVehiclePreference: siteSettings.showVehiclePreference })
          .from(siteSettings).where(eq(siteSettings.id, 1)).limit(1),
        db.select().from(customReservationFields)
          .where(eq(customReservationFields.isActive, true))
          .orderBy(asc(customReservationFields.sortOrder), asc(customReservationFields.id)),
      ]);

    return {
      serviceTypes: serviceRows.length ? serviceRows : FALLBACK_BOOKING_SERVICE_TYPES,
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
    };
  },
  ['booking-form-initial-data'],
  { revalidate: 300, tags: [BOOKING_FORM_BOOTSTRAP_TAG] },
);

const getCachedBookingFormOptions = unstable_cache(
  async (lang: string): Promise<BookingFormOptions> => {
    const [locationRows, vehicleRows, defaultFeatureCodes] = await Promise.all([
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
          .where(and(
            isNull(locations.archivedAt),
            eq(locations.isActive, true),
            notInArray(locations.slug, [...PUBLICLY_UNAVAILABLE_BOOKING_LOCATION_SLUGS]),
          ))
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
      vehicles: resolvedVehicles.map((vehicle) => ({
        id: vehicle.id,
        slug: vehicle.slug,
        displayName: vehicle.displayName,
        passengerCapacity: vehicle.passengerCapacity,
        vehicleType: vehicle.vehicleType,
      })),
      locations: {
        localPickup: sortLocations(localRows.filter((row) => row.pickupEnabled).map(toPublicLocation), 'local'),
        localDropoff: sortLocations(localRows.filter((row) => row.dropoffEnabled).map(toPublicLocation), 'local'),
        intercityPickup: sortLocations(intercityRows.filter((row) => row.pickupEnabled).map(toPublicLocation), 'intercity'),
        intercityDropoff: sortLocations(intercityRows.filter((row) => row.dropoffEnabled).map(toPublicLocation), 'intercity'),
      },
    };
  },
  ['booking-form-options'],
  { revalidate: 300, tags: [BOOKING_FORM_BOOTSTRAP_TAG] },
);

export async function getBookingFormInitialData(): Promise<BookingFormInitialData> {
  try {
    return await getCachedBookingFormInitialData();
  } catch (error) {
    console.error('Booking form initial data error:', error);
    return EMPTY_BOOKING_FORM_INITIAL_DATA;
  }
}

export async function getBookingFormOptions(lang: string): Promise<BookingFormOptions> {
  try {
    return await getBookingFormOptionsStrict(lang);
  } catch (error) {
    console.error('Booking form options error:', error);
    return EMPTY_BOOKING_FORM_OPTIONS;
  }
}

export async function getBookingFormOptionsStrict(lang: string): Promise<BookingFormOptions> {
  return getCachedBookingFormOptions(lang);
}

export async function getBookingFormBootstrap(lang: string): Promise<BookingFormBootstrap> {
  const [initial, options] = await Promise.all([
    getBookingFormInitialData(),
    getBookingFormOptions(lang),
  ]);
  return { ...initial, ...options };
}

export function revalidateBookingFormBootstrap(): void {
  revalidateTag(BOOKING_FORM_BOOTSTRAP_TAG);
}