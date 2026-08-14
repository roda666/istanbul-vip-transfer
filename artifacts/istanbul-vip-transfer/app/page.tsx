import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import Hero from '@/components/Hero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Services from '@/components/Services';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import { faqs } from '@/lib/faq-data';
import { SITE } from '@/lib/site-config';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublishedHomepageData } from '@/lib/homepage-cms';
import { getServiceVisibilityMap } from '@/lib/service-page-cms';

// Force dynamic rendering so visibility toggle changes take effect immediately
// without requiring a redeploy.
export const dynamic = 'force-dynamic';

const BASE = SITE.siteUrl;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/', [...SUPPORTED_LANGS]);
  return {
    title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
    description:
      'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
    alternates: { canonical: BASE, languages: alts.languages },
    openGraph: {
      title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
      description:
        'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
      url: BASE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'VIP Transfer Istanbul',
  description:
    'İstanbul havalimanı ve şehir içi VIP transfer hizmeti. Mercedes Vito ve Sprinter ile 7/24 hizmet.',
  telephone: SITE.phoneE164,
  email: SITE.email,
  url: BASE,
  sameAs: [SITE.googleBusinessUrl],
  areaServed: { '@type': 'City', name: 'İstanbul' },
  priceRange: '$$',
};

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
  const [cmsData, visibilityMap] = await Promise.all([
    getPublishedHomepageData('tr'),
    getServiceVisibilityMap(),
  ]);

  // Build the set of service slugs the admin has hidden from the homepage
  const hiddenServiceSlugs = new Set(
    [...visibilityMap.entries()]
      .filter(([, flags]) => !flags.showOnHomepage)
      .map(([slug]) => slug)
  );

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero />
      <BookingForm />
      <VehicleFleet />
      <Services hiddenSlugs={hiddenServiceSlugs} />
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
