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

const BASE = 'https://www.istanbulviptransfer.com';

export const metadata: Metadata = {
  title: 'İstanbul VIP Havalimanı Transfer | Mercedes ile Lüks Yolculuk',
  description:
    'İstanbul VIP havalimanı transfer hizmeti. Mercedes Vito ve Sprinter VIP ile İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) transferleri. 7/24 WhatsApp ile rezervasyon.',
  alternates: { canonical: BASE },
  openGraph: {
    title: 'İstanbul VIP Havalimanı Transfer | Mercedes ile Lüks Yolculuk',
    description:
      'Mercedes Vito ve Sprinter VIP ile IST ve SAW havalimanı transferleri. 7/24 WhatsApp rezervasyon.',
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
  telephone: '+905326600847',
  email: 'info@istanbulviptransfer.com',
  url: BASE,
  sameAs: ['https://share.google/BaSBZMKi7j4AlQ5hO'],
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
