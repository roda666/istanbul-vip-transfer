import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/hakkimizda`;

export const metadata: Metadata = {
  title: 'Hakkımızda | İstanbul VIP Transfer',
  description:
    'İstanbul VIP Transfer\'in hizmet anlayışı, araç seçenekleri, havalimanı ve şehirler arası özel ulaşım çözümleri hakkında bilgi alın.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Hakkımızda | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer\'in hizmet anlayışı, araç seçenekleri, havalimanı ve şehirler arası özel ulaşım çözümleri hakkında bilgi alın.',
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
    { '@type': 'ListItem', position: 2, name: 'Hakkımızda', item: PAGE },
  ],
};

export default function HakkimizdaPage() {
  return (
    <>
      <PageHero pageKey="about" />
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
