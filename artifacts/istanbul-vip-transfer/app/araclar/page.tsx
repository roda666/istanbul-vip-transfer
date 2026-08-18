import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import PageHero from '@/components/PageHero';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/araclar`;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/araclar', [...SUPPORTED_LANGS]);
  return {
    title: 'VIP Araçlarımız | Vito ve Sprinter',
    description:
      'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'VIP Araçlarımız | Vito ve Sprinter',
      description:
        'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Araçlarımız', item: PAGE },
  ],
};

interface DbVehicle {
  id: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  vehicle_type: string | null;
  cover_image: string | null;
}

async function getVehicles(): Promise<DbVehicle[]> {
  try {
    const { db } = await import('@/db');
    const result = await db.execute(
      `SELECT id, name, short_description, full_description,
              passenger_capacity, luggage_capacity, vehicle_type, cover_image
       FROM vehicles
       WHERE archived_at IS NULL
       ORDER BY display_order NULLS LAST, name` as never,
    );
    return (result as unknown as DbVehicle[]) ?? [];
  } catch {
    return [];
  }
}

function buildImageUrl(path: string | null): string {
  if (!path) return SITE.ogImage.url;
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

function buildVehicleSchema(vehicles: DbVehicle[]) {
  if (vehicles.length === 0) return null;

  const vehicleTypeMap: Record<string, string> = {
    SEDAN: 'Car',
    MPV: 'Car',
    MINIVAN: 'Car',
    MINIBUS: 'BusOrCoach',
    SUV: 'Car',
  };

  const items = vehicles.map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': vehicleTypeMap[v.vehicle_type ?? ''] ?? 'Car',
      name: v.name,
      description: v.full_description ?? v.short_description ?? undefined,
      image: buildImageUrl(v.cover_image),
      url: `${PAGE}#${v.id}`,
      vehicleSeatingCapacity: v.passenger_capacity ?? undefined,
      brand: { '@type': 'Brand', name: 'Mercedes-Benz' },
      offers: {
        '@type': 'Offer',
        seller: {
          '@type': 'LocalBusiness',
          '@id': `${BASE}/#business`,
          name: 'İstanbul VIP Transfer',
        },
        availability: 'https://schema.org/InStock',
        priceCurrency: 'EUR',
        areaServed: 'Istanbul, Turkey',
      },
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'VIP Transfer Araç Filosu',
    description: 'İstanbul VIP Transfer hizmetlerinde kullanılan Mercedes lüks araç filomuz',
    url: PAGE,
    numberOfItems: vehicles.length,
    itemListElement: items,
  };
}

export default async function AraclarPage() {
  const vehicles = await getVehicles();
  const vehicleSchema = buildVehicleSchema(vehicles);

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
