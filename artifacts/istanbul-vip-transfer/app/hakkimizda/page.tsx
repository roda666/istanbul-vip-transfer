import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import PageHero from '@/components/PageHero';
import HakkimizdaArticle from '@/components/HakkimizdaArticle';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';
import { getContactSettings, type ContactSettings } from '@/lib/site-settings-server';
import { serializeJsonLd } from '@/lib/json-ld';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/hakkimizda`;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/hakkimizda', [...SUPPORTED_LANGS]);
  return {
    title: 'Hakkımızda | İstanbul VIP Transfer',
    description:
      "İstanbul VIP Transfer'in hizmet anlayışı, araç seçenekleri, havalimanı ve şehirler arası özel ulaşım çözümleri hakkında bilgi alın.",
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'Hakkımızda | İstanbul VIP Transfer',
      description:
        "İstanbul VIP Transfer'in hizmet anlayışı, araç seçenekleri, havalimanı ve şehirler arası özel ulaşım çözümleri hakkında bilgi alın.",
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
    { '@type': 'ListItem', position: 2, name: 'Hakkımızda', item: PAGE },
  ],
};

function buildOrganizationSchema(cs: ContactSettings) {
  return {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${BASE}/#organization`,
  name: 'İstanbul VIP Transfer',
  alternateName: 'VIP Transfer Istanbul',
  url: BASE,
  logo: {
    '@type': 'ImageObject',
    url: `${BASE}/logo.png`,
     width: 3200,
     height: 1240,
  },
  image: SITE.ogImage.url,
  description:
    'İstanbul\'da Mercedes Vito ve Sprinter ile profesyonel VIP havalimanı transferi ve şehirler arası özel ulaşım hizmetleri.',
  telephone: SITE.phoneE164,
  email: SITE.email,
  address: {
    '@type': 'PostalAddress',
    ...(cs.fullAddress ? { streetAddress: cs.fullAddress } : {}),
    addressLocality: 'İstanbul',
    addressCountry: 'TR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 41.0082,
    longitude: 28.9784,
  },
  areaServed: [
    { '@type': 'City', name: 'İstanbul' },
    { '@type': 'Country', name: 'Türkiye' },
  ],
  serviceType: ['VIP Havalimanı Transferi', 'Şehirler Arası Transfer', 'Özel Tur', 'Kurumsal Transfer'],
  knowsLanguage: ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phoneE164,
    contactType: 'customer service',
    availableLanguage: ['Turkish', 'English'],
    contactOption: 'TollFree',
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
  },
  sameAs: [
    cs.googleBusinessUrl,
    'https://www.instagram.com/istanbulviptransfer',
  ].filter(Boolean),
  };
}

const aboutPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${PAGE}#webpage`,
  url: PAGE,
  name: 'Hakkımızda — İstanbul VIP Transfer',
  description:
    "İstanbul VIP Transfer'in hizmet anlayışı ve araç filosu hakkında bilgi edinin.",
  isPartOf: { '@id': `${BASE}/#website` },
  about: { '@id': `${BASE}/#organization` },
  inLanguage: 'tr-TR',
};

const aboutArticleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${PAGE}#article`,
  mainEntityOfPage: { '@id': `${PAGE}#webpage` },
  headline: 'Hakkımızda — İstanbul VIP Transfer',
  description: "İstanbul VIP Transfer'in hizmet anlayışı, araç filosu ve özel ulaşım çözümleri hakkında bilgi edinin.",
  image: SITE.ogImage.url,
  author: { '@id': `${BASE}/#organization` },
  publisher: {
    '@type': 'Organization',
    '@id': `${BASE}/#organization`,
    name: 'İstanbul VIP Transfer',
     logo: {
       '@type': 'ImageObject',
       url: `${BASE}/logo.png`,
       width: 3200,
       height: 1240,
     },
  },
  inLanguage: 'tr-TR',
  about: { '@id': `${BASE}/#organization` },
};

export default async function HakkimizdaPage() {
  const contactSettings = await getContactSettings();
  const organizationSchema = buildOrganizationSchema(contactSettings);

  return (
    <>
      <PageHero pageKey="about" />
      <HakkimizdaArticle />
      <TrustSignals />
      <Reviews />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutArticleSchema) }}
      />
    </>
  );
}
