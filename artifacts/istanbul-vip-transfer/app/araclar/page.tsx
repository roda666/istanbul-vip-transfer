import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';

const BASE = 'https://www.istanbulviptransfer.com';
const PAGE = `${BASE}/araclar`;

export const metadata: Metadata = {
  title: 'VIP Araç Filosumuz | Mercedes Vito ve Sprinter',
  description:
    'Mercedes Vito (7 yolcu) ve Mercedes Sprinter VIP (13 yolcu) araçlarımızla bireysel ve grup transferleri. Lüks iç mekan, WiFi, meet & greet hizmeti.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'VIP Araç Filosumuz | Mercedes Vito ve Sprinter',
    description:
      'Mercedes Vito ve Sprinter VIP ile bireysel ve grup transferleri. WiFi, iklimlendirme, meet & greet.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
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
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Araçlarımız' },
        ]}
        title="Lüks Mercedes Araç Filosumuz"
        subtitle="Bireysel yolculardan büyük gruplara — her ihtiyaca uygun iki VIP araç seçeneği."
      />
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
