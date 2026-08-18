/**
 * Translated homepage for /en, /de, /ru, /ar, /fr, /es, /it, /nl
 *
 * Reads published CMS data server-side and provides it via HomepageCmsProvider.
 * Falls back to the static i18n dictionaries if the database is unavailable.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';
// Renamed to avoid conflict with Next.js's `export const dynamic` route segment config
import lazyLoad from 'next/dynamic';
import type { TransferRoute } from '@/db/schema';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublishedHomepageData } from '@/lib/homepage-cms';
import { getServiceVisibilityMap } from '@/lib/service-page-cms';
// Above-fold: static imports
import BookingForm from '@/components/BookingForm';
import Hero from '@/components/Hero';
// Below-fold: lazy-loaded client components (each gets its own JS chunk)
const VehicleFleet         = lazyLoad(() => import('@/components/VehicleFleet'));
const Services             = lazyLoad(() => import('@/components/Services'));
const PopularRoutesSection = lazyLoad(() => import('@/components/PopularRoutesSection'));
const TrustSignals         = lazyLoad(() => import('@/components/TrustSignals'));
const Reviews              = lazyLoad(() => import('@/components/Reviews'));
const FAQ                  = lazyLoad(() => import('@/components/FAQ'));
const Contact              = lazyLoad(() => import('@/components/Contact'));

async function getTransferRoutes(): Promise<TransferRoute[]> {
  try {
    const { db } = await import('@/db');
    const { transferRoutes } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');
    return db.select().from(transferRoutes).where(eq(transferRoutes.active, true)).orderBy(asc(transferRoutes.displayOrder));
  } catch {
    return [];
  }
}

// Force dynamic rendering so visibility toggle changes take effect immediately.
export const dynamic = 'force-dynamic';

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
      es: 'Istanbul VIP Transfer | Traslados de lujo al aeropuerto y ciudad',
      fr: 'Istanbul VIP Transfer | Transferts luxe aéroport et ville',
      it: 'Istanbul VIP Transfer | Trasferimenti di lusso aeroporto e città',
      nl: 'Istanbul VIP Transfer | Luxe luchthaven- en stadstransfers',
    };
    const descriptions: Record<string, string> = {
      en: 'Premium airport transfers, intercity transport and private tours in Istanbul with luxury Mercedes Vito & Sprinter. 24/7 service.',
      de: 'Premiumtransfers vom Flughafen, Stadtfahrten und Privattouren in Istanbul mit luxuriösen Mercedes Vito & Sprinter. 24/7 Service.',
      ru: 'Премиальные трансферы из аэропорта, городские перевозки и частные туры в Стамбуле на люксовых Mercedes Vito и Sprinter. Работаем 24/7.',
      ar: 'خدمة نقل فاخرة من المطار والمدينة وجولات خاصة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر. خدمة 24/7.',
      es: 'Traslados premium al aeropuerto, transporte interurbano y tours privados en Estambul con Mercedes Vito y Sprinter de lujo. Servicio 24/7.',
      fr: "Transferts premium depuis l\u2019a\u00E9roport, transport interurbain et tours priv\u00E9s \u00E0 Istanbul avec des Mercedes Vito & Sprinter de luxe. Service 24/7.",
      it: "Trasferimenti premium dall\u2019aeroporto, trasporto intercitt\u00E0 e tour privati a Istanbul con Mercedes Vito e Sprinter di lusso. Servizio 24/7.",
      nl: 'Premium luchthaventransfers, intercity vervoer en privérondleidingen in Istanbul met luxe Mercedes Vito & Sprinter. 24/7 service.',
    };
    seoTitle       = titles[lang] ?? titles.en;
    seoDescription = descriptions[lang] ?? descriptions.en;
  }

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      // Each locale page must canonicalize to its own URL, not the TR root.
      canonical: `${SITE.siteUrl}/${lang}`,
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

  // Read published CMS data and service visibility server-side
  const [cmsData, visibilityMap, cs, transferRoutes] = await Promise.all([
    getPublishedHomepageData(lang),
    getServiceVisibilityMap(),
    getContactSettings(),
    getTransferRoutes(),
  ]);

  const hiddenServiceSlugs = new Set(
    [...visibilityMap.entries()]
      .filter(([, flags]) => !flags.showOnHomepage)
      .map(([slug]) => slug)
  );

  const pageUrl = `${SITE.siteUrl}/${lang}`;
  const inLanguage: Record<string, string> = {
    en: 'en', de: 'de', ru: 'ru', ar: 'ar',
    es: 'es', fr: 'fr', it: 'it', nl: 'nl',
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
      telephone: cs.phoneE164,
      email: cs.email,
      sameAs: [cs.googleBusinessUrl],
    },
  };

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero />
      <BookingForm />
      <VehicleFleet />
      <Services hiddenSlugs={hiddenServiceSlugs} />
      <PopularRoutesSection routes={transferRoutes} />
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
