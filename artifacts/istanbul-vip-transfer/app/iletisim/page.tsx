import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import BookingForm from '@/components/BookingForm';

const BASE = 'https://www.istanbulviptransfer.com';
const PAGE = `${BASE}/iletisim`;

export const metadata: Metadata = {
  title: 'İletişim | VIP Transfer Istanbul — 7/24 WhatsApp Desteği',
  description:
    'VIP Transfer Istanbul iletişim. +90 532 660 08 47 numaralı hattımızı arayın veya WhatsApp üzerinden rezervasyon yapın. 7/24 hizmet.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'İletişim | VIP Transfer Istanbul',
    description:
      '+90 532 660 08 47 — 7/24 ulaşın. WhatsApp ile hızlı rezervasyon ve destek.',
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
