import PageHero from '@/components/PageHero';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { getDictionary, type SiteLang } from '@/lib/i18n';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const ROOT_PAGE = `${BASE}/araclar`;

interface DbVehicle {
  id: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_type: string | null;
  cover_image: string | null;
  name_translations: Record<string, string> | null;
  short_desc_translations: Record<string, string> | null;
}

async function getVehicles(locale: SiteLang): Promise<DbVehicle[]> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT id, name, short_description, full_description,
              passenger_capacity, luggage_capacity, vehicle_type, cover_image,
              name_translations, short_desc_translations
       FROM vehicles
       WHERE archived_at IS NULL
       ORDER BY display_order NULLS LAST, name` as never,
    );
    const rows = (result as unknown as DbVehicle[]) ?? [];
    if (locale === 'tr') return rows;

    // Do not serialize Turkish source names or descriptions into a localized
    // vehicle schema. An incomplete translation is omitted until it is ready.
    return rows.flatMap((vehicle) => {
      const name = vehicle.name_translations?.[locale];
      const description = vehicle.short_desc_translations?.[locale];
      if (!name || !description) return [];
      return [{
        ...vehicle,
        name,
        short_description: description,
        full_description: description,
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

function buildVehicleSchema(vehicles: DbVehicle[], locale: SiteLang) {
  if (vehicles.length === 0) return null;
  const dict = getDictionary(locale);
  const pageUrl = locale === 'tr' ? ROOT_PAGE : `${BASE}/${locale}/araclar`;
  const vehicleTypeMap: Record<string, string> = {
    SEDAN: 'Car',
    MPV: 'Car',
    MINIVAN: 'Car',
    MINIBUS: 'BusOrCoach',
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
        brand: { '@type': 'Brand', name: 'Mercedes-Benz' },
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

function buildBreadcrumbSchema(locale: SiteLang) {
  const dict = getDictionary(locale);
  const pageUrl = locale === 'tr' ? ROOT_PAGE : `${BASE}/${locale}/araclar`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.footer.homeLink, item: locale === 'tr' ? BASE : `${BASE}/${locale}` },
      { '@type': 'ListItem', position: 2, name: dict.footer.vehiclesLink, item: pageUrl },
    ],
  };
}

export default async function VehiclesPageContent({ locale }: { locale: SiteLang }) {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {vehicleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }}
        />
      )}
    </>
  );
}