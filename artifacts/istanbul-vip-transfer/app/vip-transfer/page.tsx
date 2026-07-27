import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Services from '@/components/Services';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';

const BASE = 'https://www.istanbulviptransfer.com';
const PAGE = `${BASE}/vip-transfer`;

export const metadata: Metadata = {
  title: 'İstanbul VIP Transfer Hizmetleri | Özel Araçla Transfer',
  description:
    'İstanbul VIP transfer hizmetleri. Havalimanı, otel, kurumsal, şehir turu ve özel etkinlik transferleri. Mercedes Vito ve Sprinter ile 7/24 hizmet.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'İstanbul VIP Transfer Hizmetleri',
    description:
      'Havalimanı, otel, kurumsal ve özel etkinlik transferleri. Mercedes araçlar, 7/24 destek.',
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
    { '@type': 'ListItem', position: 2, name: 'VIP Transfer Hizmetleri', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'İstanbul VIP Transfer Hizmetleri',
  description:
    'İstanbul genelinde havalimanı, otel, kurumsal, şehir turu, özel etkinlik ve şehirler arası transferler.',
  provider: { '@type': 'LocalBusiness', name: 'VIP Transfer Istanbul', telephone: '+905326600847', email: 'info@istanbulviptransfer.com' },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'VIP Transfer',
};

export default function VipTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'VIP Transfer Hizmetleri' },
        ]}
        title="İstanbul VIP Transfer Hizmetleri"
        subtitle="Havalimanı transferinden kurumsal transfere, otel transferinden özel etkinliklere — tüm ihtiyaçlarınız için lüks Mercedes araçlarla hizmetinizdeyiz."
      />
      <Services />
      <VehicleFleet />
      <BookingForm />
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
