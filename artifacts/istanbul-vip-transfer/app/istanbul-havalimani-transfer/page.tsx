import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';

const BASE = 'https://www.istanbulviptransfer.com';
const PAGE = `${BASE}/istanbul-havalimani-transfer`;

export const metadata: Metadata = {
  title: 'İstanbul Havalimanı (IST) VIP Transfer Hizmeti',
  description:
    'İstanbul Havalimanı (IST) VIP transfer hizmeti. Mercedes Vito ve Sprinter ile karşılama, bagaj yardımı ve konforlu ulaşım. WhatsApp ile rezervasyon.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'İstanbul Havalimanı (IST) VIP Transfer',
    description:
      'IST Havalimanı transfer hizmeti. Mercedes araçlar, karşılama tabelası ve 7/24 destek.',
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
    { '@type': 'ListItem', position: 2, name: 'İstanbul Havalimanı Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'İstanbul Havalimanı (IST) VIP Transfer',
  description:
    'İstanbul Havalimanı\'ndan şehir merkezine ve tüm destinasyonlara Mercedes VIP araçlarla karşılama ve transfer hizmeti.',
  provider: { '@type': 'LocalBusiness', name: 'VIP Transfer Istanbul', telephone: '+905055877006' },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Airport Transfer',
};

export default function IstanbulHavalimaniPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'İstanbul Havalimanı Transfer' },
        ]}
        title="İstanbul Havalimanı (IST) VIP Transfer"
        subtitle="İstanbul Havalimanı'ndan her destinasyona Mercedes Vito ve Sprinter VIP ile profesyonel karşılama ve transfer hizmeti."
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
