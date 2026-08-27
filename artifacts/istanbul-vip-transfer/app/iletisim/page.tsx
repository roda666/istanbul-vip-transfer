import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import ContactForm from '@/components/ContactForm';
import { SITE } from '@/lib/site-config';
import { getContactSettings, type ContactSettings } from '@/lib/site-settings-server';
import { serializeJsonLd } from '@/lib/json-ld';

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

function buildContactPageSchema(cs: ContactSettings) {
  return {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: `İletişim | ${cs.businessName}`,
  url: PAGE,
  description:
    'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
  mainEntity: {
    '@type': 'LocalBusiness',
    name: cs.businessName,
    url: BASE,
    telephone: cs.phoneE164,
    email: cs.email,
    address: {
      '@type': 'PostalAddress',
      ...(cs.fullAddress ? { streetAddress: cs.fullAddress } : {}),
      addressLocality: 'İstanbul',
      addressCountry: 'TR',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    ],
  },
  };
}

export default async function IletisimPage() {
  const contactSettings = await getContactSettings();
  const contactPageSchema = buildContactPageSchema(contactSettings);

  return (
    <>
      <PageHero pageKey="contact" />
      <Contact />
      <ContactForm />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(contactPageSchema) }}
      />
    </>
  );
}
