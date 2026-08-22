import type { Metadata } from 'next';
// Renamed to avoid conflict with Next.js's `export const dynamic` route segment config
import lazyLoad from 'next/dynamic';
// Above-fold: static imports (always in initial bundle)
import Hero from '@/components/Hero';
import DeferredBookingForm from '@/components/DeferredBookingForm';
import DeferredVehicleFleet from '@/components/DeferredVehicleFleet';
// Below-fold: lazy-loaded client components (each gets its own JS chunk)
const Services             = lazyLoad(() => import('@/components/Services'));
const PopularRoutesSection = lazyLoad(() => import('@/components/PopularRoutesSection'));
const TrustSignals         = lazyLoad(() => import('@/components/TrustSignals'));
const Reviews              = lazyLoad(() => import('@/components/Reviews'));
const FAQ                  = lazyLoad(() => import('@/components/FAQ'));
const Contact              = lazyLoad(() => import('@/components/Contact'));
import { faqs } from '@/lib/faq-data';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublishedHomepageData } from '@/lib/homepage-cms';
import { getServiceVisibilityMap } from '@/lib/service-page-cms';
import type { TransferRoute } from '@/db/schema';

// ISR: serve pre-rendered HTML instantly; revalidate in background every 5 min.
// Admin publish routes call revalidatePath() for on-demand invalidation,
// so homepage content updates appear within seconds of a publish action.
export const revalidate = 300;

async function getTransferRoutes(): Promise<TransferRoute[]> {
  try {
    const { db } = await import('@/db');
    const { transferRoutes } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');
    return db.select().from(transferRoutes).where(eq(transferRoutes.active, true)).orderBy(asc(transferRoutes.displayOrder));
  } catch {
    return [];
  }
}

const BASE = SITE.siteUrl;

const TITLE = 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti';
const DESCRIPTION = 'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: BASE,
    languages: {
      'x-default': BASE,
      'tr-TR': BASE,
      'ar-SA': `${BASE}/ar`,
      'de-DE': `${BASE}/de`,
      'en-GB': `${BASE}/en`,
      'es-ES': `${BASE}/es`,
      'fr-FR': `${BASE}/fr`,
      'it-IT': `${BASE}/it`,
      'nl-NL': `${BASE}/nl`,
      'ru-RU': `${BASE}/ru`,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
    images: [SITE.ogImage],
  },
  robots: { index: true, follow: true },
};

// localBusinessSchema is built inside HomePage() so contact fields reflect DB values.

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
};

export default async function HomePage() {
  // Read published CMS data server-side; falls back to static i18n if DB unavailable
  const [cmsData, visibilityMap, cs, transferRoutes] = await Promise.all([
    getPublishedHomepageData('tr'),
    getServiceVisibilityMap(),
    getContactSettings(),
    getTransferRoutes(),
  ]);

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE}/#business`,
    name: 'VIP Transfer Istanbul',
    description:
      'İstanbul havalimanı ve şehir içi VIP transfer hizmeti. Mercedes Vito ve Sprinter ile 7/24 hizmet.',
    url: BASE,
    telephone: cs.phoneE164,
    email: cs.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'İstanbul',
      addressRegion: 'İstanbul',
      addressCountry: 'TR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 41.0082,
      longitude: 28.9784,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    ],
    sameAs: [cs.googleBusinessUrl].filter(Boolean),
    areaServed: [
      { '@type': 'City', name: 'İstanbul' },
      { '@type': 'Country', name: 'Türkiye' },
    ],
    priceRange: '$$',
    serviceType: 'Transportation Service',
    knowsLanguage: ['Turkish', 'English', 'German', 'Russian', 'Arabic'],
    image: SITE.ogImage,
  };

  // Build the set of service slugs the admin has hidden from the homepage
  const hiddenServiceSlugs = new Set(
    [...visibilityMap.entries()]
      .filter(([, flags]) => !flags.showOnHomepage)
      .map(([slug]) => slug)
  );

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero />
      <DeferredBookingForm />
      <DeferredVehicleFleet />
      <Services hiddenSlugs={hiddenServiceSlugs} />
      <PopularRoutesSection routes={transferRoutes} />
      <TrustSignals />
      <Reviews />
      <FAQ />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </HomepageCmsProvider>
  );
}
