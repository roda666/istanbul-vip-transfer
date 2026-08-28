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
import { getServiceOgImageUrl } from '@/lib/service-og-images';
// Renamed to avoid conflict with Next.js's `export const dynamic` route segment config
import lazyLoad from 'next/dynamic';
import { HomepageCmsProvider } from '@/lib/homepage-cms-context';
import { getPublishedHomepageData } from '@/lib/homepage-cms';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';
import { localizedServicePath } from '@/lib/localized-service-path';
import { getPublicHomepageData } from '@/lib/homepage-public-data';
import { serializeJsonLd } from '@/lib/json-ld';
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

// ISR: serve pre-rendered HTML instantly; revalidate in background every 5 min.
// Admin publish routes call revalidatePath() for on-demand invalidation.
export const revalidate = 300;

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) {
    // See the matching render branch: this root dynamic segment also serves
    // published CMS services whose slug has no hand-authored route folder.
    const catalog = await getPublicServiceCatalog('tr');
    const service = catalog.services.find((item) => item.slug === lang);
    if (!service) return {};

    const { getPublishedServicePage } = await import('@/lib/service-page-cms');
    const page = await getPublishedServicePage(service.slug, 'tr');
    const title = page?.seoTitle ?? page?.title ?? service.title;
    const description = page?.seoDescription ?? service.excerpt ?? undefined;
    const url = `${SITE.siteUrl}${localizedServicePath(service.slug, 'tr')}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: 'VIP Transfer Istanbul',
        locale: 'tr_TR',
        type: 'website',
        images: [{
          url: getServiceOgImageUrl(service.slug, SITE.siteUrl),
          width: 1200,
          height: 630,
        }],
      },
      robots: { index: true, follow: true },
    };
  }

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
  if (!isValidLang(lang)) {
    // The [lang] segment is also Next's root dynamic fallback. A published CMS
    // service with a non-registry slug is served here at /{service-slug}.
    const catalog = await getPublicServiceCatalog('tr');
    const service = catalog.services.find((item) => item.slug === lang);
    if (!service) notFound();
    const { default: ServicePageRenderer } = await import('@/components/ServicePageRenderer');
    return <ServicePageRenderer slug={service.slug} lang="tr" canonicalPath={localizedServicePath(service.slug, 'tr')} />;
  }

  // Read published CMS data and service visibility server-side
  const {
    cmsData,
    serviceCatalog,
    contactSettings: cs,
    transferRoutes,
    reviews,
    homepageFaqs,
    serviceCopy,
  } = await getPublicHomepageData(lang);

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
      logo: {
        '@type': 'ImageObject',
        url: SITE.logoUrl,
        width: 600,
        height: 240,
      },
      telephone: cs.phoneE164,
      email: cs.email,
      sameAs: [cs.googleBusinessUrl],
    },
  };

  return (
    <HomepageCmsProvider data={cmsData}>
      <Hero homepageMode />
      <BookingForm homepageMode />
      <VehicleFleet homepageMode />
      <div className="ivt-deferred-section">
        <Services catalogServices={serviceCatalog.services} serviceCopy={serviceCopy} homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <PopularRoutesSection routes={transferRoutes} />
      </div>
      <div className="ivt-deferred-section">
        <TrustSignals homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <Reviews items={reviews} homepageMode />
      </div>
      <div className="ivt-deferred-section">
        <FAQ items={homepageFaqs} />
      </div>
      <div className="ivt-deferred-section">
        <Contact homepageMode />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageSchema) }}
      />
    </HomepageCmsProvider>
  );
}
