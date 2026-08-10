/**
 * Translated homepage for /en, /de, /ru, /ar
 *
 * Reads published CMS data server-side and provides it via HomepageCmsProvider.
 * Falls back to the static i18n dictionaries if the database is unavailable.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import BookingForm from '@/components/BookingForm';
import Hero from '@/components/Hero';
import VehicleFleet from '@/components/VehicleFleet';
import Services from '@/components/Services';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublishedHomepageData } from '@/lib/homepage-cms';

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};

  const alternates = await buildAlternates('/', [...SUPPORTED_LANGS]);

  // Try to read SEO from DB; fall back to hardcoded defaults
  let seoTitle: string;
  let seoDescription: string;
  try {
    const cmsData = await getPublishedHomepageData(lang);
    seoTitle       = cmsData.seo.metaTitle;
    seoDescription = cmsData.seo.metaDescription;
  } catch {
    const titles: Record<string, string> = {
      en: 'Istanbul VIP Transfer | Luxury Airport & City Transfers',
      de: 'Istanbul VIP Transfer | Luxus Flughafen & Stadttransfers',
      ru: 'Стамбул VIP Трансфер | Трансфер из аэропорта и по городу',
      ar: 'إسطنبول VIP ترانسفير | نقل فاخر من المطار والمدينة',
    };
    const descriptions: Record<string, string> = {
      en: 'Premium airport transfers, intercity transport and private tours in Istanbul with luxury Mercedes Vito & Sprinter. 24/7 service.',
      de: 'Premiumtransfers vom Flughafen, Stadtfahrten und Privattouren in Istanbul mit luxuriösen Mercedes Vito & Sprinter. 24/7 Service.',
      ru: 'Премиальные трансферы из аэропорта, городские перевозки и частные туры в Стамбуле на люксовых Mercedes Vito и Sprinter. Работаем 24/7.',
      ar: 'خدمة نقل فاخرة من المطار والمدينة وجولات خاصة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر. خدمة 24/7.',
    };
    seoTitle       = titles[lang] ?? titles.en;
    seoDescription = descriptions[lang] ?? descriptions.en;
  }

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: `${SITE.siteUrl}/${lang}`,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedHomePage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  // Read published CMS data server-side; falls back to static i18n if DB unavailable
  const cmsData = await getPublishedHomepageData(lang);

  const pageUrl = `${SITE.siteUrl}/${lang}`;
  const inLanguage: Record<string, string> = {
    en: 'en', de: 'de', ru: 'ru', ar: 'ar',
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: cmsData.seo.metaTitle,
    description: cmsData.seo.metaDescription,
    url: pageUrl,
    inLanguage: inLanguage[lang] ?? lang,
    publisher: {
      '@type': 'Organization',
      name: 'VIP Transfer Istanbul',
      url: SITE.siteUrl,
      telephone: SITE.phoneE164,
      email: SITE.email,
      sameAs: [SITE.googleBusinessUrl],
    },
  };

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero />
      <BookingForm />
      <VehicleFleet />
      <Services />
      <TrustSignals />
      <Reviews />
      <FAQ />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
    </HomepageCmsProvider>
  );
}
