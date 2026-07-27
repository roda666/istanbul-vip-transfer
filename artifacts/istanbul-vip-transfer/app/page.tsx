import type { Metadata } from 'next';
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

const BASE = SITE.siteUrl;

export const metadata: Metadata = {
  title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
  description:
    'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
  alternates: { canonical: BASE },
  openGraph: {
    title: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti',
    description:
      'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.',
    url: BASE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

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

export default function HomePage() {
  return (
    <>
      <Hero />
      <BookingForm />
      <VehicleFleet />
      <Services />
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
    </>
  );
}
