import PageHero from '@/components/PageHero';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { getDictionary } from '@/lib/i18n';
import { SITE } from '@/lib/site-config';
import { resolvePublicVehicle } from '@/lib/vehicle-localization';
import { resolveVehicleBrand } from '@/lib/vehicle-brand';
import { localizedStaticPath } from '@/lib/localized-service-path';
import { serializeJsonLd } from '@/lib/json-ld';

const BASE = SITE.siteUrl;

function getPageUrl(locale: string): string {
  return `${BASE}${localizedStaticPath('araclar', locale)}`;
}

interface DbVehicle {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_type: string | null;
  cover_image: string | null;
  name_translations: Record<string, string> | null;
  short_desc_translations: Record<string, string> | null;
  tagline_translations: Record<string, string> | null;
  features: Array<{ icon?: string; label?: string }> | null;
  is_featured: boolean;
  display_order: number;
}

async function getVehicles(locale: string): Promise<DbVehicle[]> {
  try {
    const { db } = await import('@/db');
    const { vehicles } = await import('@/db/schema');
    const { asc, eq } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.status, 'PUBLISHED'))
      .orderBy(asc(vehicles.displayOrder), asc(vehicles.name));

    return rows.flatMap((vehicle) => {
      const localized = resolvePublicVehicle(vehicle, locale);
      if (!localized) return [];
      return [{
        id: localized.id,
        name: localized.displayName,
        slug: localized.slug,
        short_description: localized.displayShortDesc,
        // Full descriptions have no translation column. The localized short
        // description is deliberately used in JSON-LD rather than Turkish.
        full_description: localized.displayShortDesc,
        passenger_capacity: localized.passengerCapacity,
        luggage_capacity: localized.luggageCapacity,
        vehicle_type: localized.vehicleType,
        cover_image: localized.coverImage,
        name_translations: null,
        short_desc_translations: null,
        tagline_translations: null,
        features: null,
        is_featured: localized.isFeatured,
        display_order: localized.displayOrder,
      }];
    });
  } catch {
    return [];
  }
}

function buildImageUrl(path: string | null): string {
  if (!path) return SITE.ogImage.url;
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

function buildVehicleSchema(vehicles: DbVehicle[], locale: string) {
  if (vehicles.length === 0) return null;
  const dict = getDictionary(locale);
  const pageUrl = getPageUrl(locale);
  const vehicleTypeMap: Record<string, string> = {
    SEDAN: 'Car',
    MPV: 'Car',
    MINIVAN: 'Car',
    MINIBUS: 'BusOrCoach',
    minivan: 'Car',
    minibus: 'BusOrCoach',
    midibus: 'BusOrCoach',
    bus: 'BusOrCoach',
    SUV: 'Car',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: dict.vehicles.heading,
    description: dict.vehicles.subheading,
    url: pageUrl,
    numberOfItems: vehicles.length,
    itemListElement: vehicles.map((vehicle, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': vehicleTypeMap[vehicle.vehicle_type ?? ''] ?? 'Car',
        name: vehicle.name,
        description: vehicle.full_description ?? vehicle.short_description ?? undefined,
        image: buildImageUrl(vehicle.cover_image),
        url: `${pageUrl}#${vehicle.id}`,
        vehicleSeatingCapacity: vehicle.passenger_capacity ?? undefined,
        ...(resolveVehicleBrand(vehicle.name) ? { brand: resolveVehicleBrand(vehicle.name) } : {}),
        offers: {
          '@type': 'Offer',
          seller: {
            '@type': 'LocalBusiness',
            '@id': `${BASE}/#business`,
            name: 'VIP Transfer Istanbul',
          },
          availability: 'https://schema.org/InStock',
          priceCurrency: 'EUR',
          areaServed: 'Istanbul, Turkey',
        },
      },
    })),
  };
}

function buildBreadcrumbSchema(locale: string) {
  const dict = getDictionary(locale);
  const pageUrl = getPageUrl(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.footer.homeLink, item: locale === 'tr' ? BASE : `${BASE}/${locale}` },
      { '@type': 'ListItem', position: 2, name: dict.footer.vehiclesLink, item: pageUrl },
    ],
  };
}

export default async function VehiclesPageContent({ locale }: { locale: string }) {
  const vehicles = await getVehicles(locale);
  const vehicleSchema = buildVehicleSchema(vehicles, locale);
  const breadcrumbSchema = buildBreadcrumbSchema(locale);

  return (
    <>
      <PageHero pageKey="vehicles" />
      <VehicleFleet />
      <BookingForm />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      {vehicleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(vehicleSchema) }}
        />
      )}
    </>
  );
}