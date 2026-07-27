import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sabiha-gokcen-havalimani-transfer`;

export const metadata: Metadata = {
  title: 'Sabiha Gökçen Transfer | VIP Vito',
  description:
    'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Sabiha Gökçen Transfer | VIP Vito',
    description:
      'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
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
    { '@type': 'ListItem', position: 2, name: 'Sabiha Gökçen Havalimanı Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Sabiha Gökçen Havalimanı (SAW) VIP Transfer',
  description:
    'Sabiha Gökçen Havalimanı\'ndan şehir merkezine ve tüm destinasyonlara Mercedes VIP araçlarla karşılama ve transfer hizmeti.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Airport Transfer',
};

export default function SabihaGokcenPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Sabiha Gökçen Havalimanı Transfer' },
        ]}
        title="Sabiha Gökçen Havalimanı (SAW) VIP Transfer"
        subtitle="Sabiha Gökçen Havalimanı'ndan her destinasyona Mercedes Vito ve Sprinter VIP ile profesyonel karşılama ve transfer hizmeti."
      />
      <BookingForm />
      <VehicleFleet />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </>
  );
}
