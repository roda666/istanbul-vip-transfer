import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';

const BASE = 'https://www.istanbulviptransfer.com';
const PAGE = `${BASE}/hakkimizda`;

export const metadata: Metadata = {
  title: 'Hakkımızda | VIP Transfer Istanbul',
  description:
    'VIP Transfer Istanbul hakkında. IST ve SAW havalimanı transferleri, Meet & Greet hizmeti, 7/24 rezervasyon desteği. Mercedes Vito ve Sprinter VIP filosu.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Hakkımızda | VIP Transfer Istanbul',
    description:
      'İstanbul VIP transfer hizmet anlayışımız. 7/24 destek, IST & SAW transferleri, lüks Mercedes filosu.',
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
    { '@type': 'ListItem', position: 2, name: 'Hakkımızda', item: PAGE },
  ],
};

export default function HakkimizdaPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hakkımızda' },
        ]}
        title="Hakkımızda"
        subtitle="VIP Transfer Istanbul olarak hizmet anlayışımız, araç filomuz ve müşteri memnuniyetine verdiğimiz önem hakkında bilgi edinin."
      />
      <TrustSignals />
      <Reviews />
      <BookingForm />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
