import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import BookingForm from '@/components/BookingForm';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/iletisim`;

export const metadata: Metadata = {
  title: 'İletişim | İstanbul VIP Transfer',
  description:
    'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'İletişim | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
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
    { '@type': 'ListItem', position: 2, name: 'İletişim', item: PAGE },
  ],
};

export default function IletisimPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'İletişim' },
        ]}
        title="İletişim"
        subtitle="Sorularınız ve rezervasyonlarınız için 7/24 WhatsApp veya telefon ile ulaşabilirsiniz."
      />
      <Contact />
      <BookingForm />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
