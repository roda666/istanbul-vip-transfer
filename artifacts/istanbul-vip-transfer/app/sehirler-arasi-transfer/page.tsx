import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sehirler-arasi-transfer`;

export const metadata: Metadata = {
  title: 'Şehirler Arası VIP Transfer | İstanbul',
  description:
    'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Şehirler Arası VIP Transfer | İstanbul',
    description:
      'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
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
    { '@type': 'ListItem', position: 2, name: 'Şehirler Arası Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Şehirler Arası VIP Transfer',
  description:
    'İstanbul\'dan Türkiye\'nin farklı şehirlerine Mercedes Vito ve Sprinter araçlarla konforlu, kapıdan kapıya özel transfer.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'Country', name: 'Türkiye' },
  serviceType: 'Intercity Transfer',
};

export default function SehirlerArasiTransferPage() {
  return (
    <>
      <PageHero pageKey="sehirlerArasi" />
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
