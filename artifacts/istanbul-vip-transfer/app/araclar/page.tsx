import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/araclar`;

export const metadata: Metadata = {
  title: 'VIP Araçlarımız | Vito ve Sprinter',
  description:
    'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
  alternates: { canonical: PAGE },
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

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Araçlarımız', item: PAGE },
  ],
};

export default function AraclarPage() {
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
    </>
  );
}
