import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import BookingForm from '@/components/BookingForm';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/iletisim`;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/iletisim', [...SUPPORTED_LANGS]);
  return {
    title: 'İletişim | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'İletişim | İstanbul VIP Transfer',
      description:
        'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

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
      <PageHero pageKey="contact" />
      <Contact />
      <BookingForm />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
