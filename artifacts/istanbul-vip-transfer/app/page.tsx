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
import { getFaqs } from '@/lib/faq-data';
import { SITE } from '@/lib/site-config';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublicHomepageData } from '@/lib/homepage-public-data';
import { serializeJsonLd } from '@/lib/json-ld';

// ISR: serve pre-rendered HTML instantly; revalidate in background every 5 min.
// Admin publish routes call revalidatePath() for on-demand invalidation,
// so homepage content updates appear within seconds of a publish action.
export const revalidate = 300;

const BASE = SITE.siteUrl;

const TITLE = 'İstanbul VIP Transfer | Minivan, Minibüs ve Otobüs';
const DESCRIPTION = 'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası minivan, minibüs, midibüs ve otobüs seçenekleri.';

export const metadata: Metadata = {
  // The root layout owns this page's identical title and description so both
  // stay in the initial head instead of being streamed as child overrides.
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

export default async function HomePage() {
  // Read published CMS data server-side; falls back to static i18n if DB unavailable
  const {
    cmsData,
    serviceCatalog,
    contactSettings: cs,
    transferRoutes,
    reviews,
    homepageFaqs,
    serviceCopy,
  } = await getPublicHomepageData('tr');
  const faqItems = homepageFaqs.length > 0 ? homepageFaqs : getFaqs('tr');
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE}/#business`,
    name: 'VIP Transfer Istanbul',
    description:
      'İstanbul havalimanı ve şehir içi VIP transfer hizmeti. Mercedes Vito ve Sprinter ile 7/24 hizmet.',
    url: BASE,
    logo: {
      '@type': 'ImageObject',
      url: SITE.logoUrl,
      width: 600,
      height: 240,
    },
    telephone: cs.phoneE164,
    email: cs.email,
    address: {
      '@type': 'PostalAddress',
      ...(cs.fullAddress ? { streetAddress: cs.fullAddress } : {}),
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

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero homepageMode />
      <DeferredBookingForm />
      <DeferredVehicleFleet homepageMode />
      <div className="ivt-deferred-section">
        <Services catalogServices={serviceCatalog.services} serviceCopy={serviceCopy} homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <PopularRoutesSection routes={transferRoutes} />
      </div>
      <div className="ivt-deferred-section">
        <TrustSignals homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <Reviews items={reviews} homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <FAQ items={homepageFaqs} />
      </div>
      <div className="ivt-deferred-section">
        <Contact homepageMode />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
      />
    </HomepageCmsProvider>
  );
}
