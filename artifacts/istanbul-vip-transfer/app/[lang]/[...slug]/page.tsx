/**
 * Locale-prefixed passthrough for Turkish content pages.
 *
 * Handles routes like /en/hizmetler, /de/istanbul-havalimani-transfer, etc.
 * The parent [lang]/layout.tsx already wraps children in <LangProvider forceLang={lang}>,
 * so Header, Footer, and all client components automatically render in the correct language.
 *
 * SEO: generateMetadata emits full Open Graph, hreflang alternates, and JSON-LD.
 * For SERVICE pages, metadata is DB-driven when a published record exists.
 *
 * NOTE: The param is named `slug` to match app/[lang]/blog/[slug]/page.tsx.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import rawPageMeta from '@/lib/page-meta.json';
import { PAGE_REGISTRY } from '@/lib/page-registry';

// ── Turkish page components (non-SERVICE pages use these directly) ─────────
import HizmetlerPage     from '@/app/hizmetler/page';
import AraclarPage       from '@/app/araclar/page';
import HakkimizdaPage    from '@/app/hakkimizda/page';
import IletisimPage      from '@/app/iletisim/page';

// ── SERVICE slug set (derived from PAGE_REGISTRY — no manual sync needed) ─
const SERVICE_SLUGS = new Set(
  Object.entries(PAGE_REGISTRY)
    .filter(([, entry]) => entry.schemaType === 'Service')
    .map(([slug]) => slug),
);

// ── Non-service static pages ─────────────────────────────────────────────
const STATIC_PAGE_MAP: Record<string, React.ComponentType> = {
  'hizmetler':  HizmetlerPage,
  'araclar':    AraclarPage,
  'hakkimizda': HakkimizdaPage,
  'iletisim':   IletisimPage,
};

// ── Page metadata (translated) ─────────────────────────────────────────────
// Each slug entry contains language keys ({ title, description }) plus an
// internal `_sourceHash` string used by the generate:page-meta script.
// The double cast suppresses the TypeScript structural mismatch — runtime
// access always uses a valid BCP-47 lang code, never "_sourceHash".
type LangMeta = Record<string, { title: string; description: string }>;
const PAGE_META: Record<string, LangMeta> = rawPageMeta as unknown as Record<string, LangMeta>;

interface Props {
  params: Promise<{ lang: string; slug: string[] }>;
}

// ── Helper: fetch DB metadata for a service page ───────────────────────────
async function getDbMeta(slug: string, lang: string): Promise<{ title?: string; description?: string; ogImage?: string } | null> {
  try {
    const { getPublishedServicePage } = await import('@/lib/service-page-cms');
    const page = await getPublishedServicePage(slug, lang);
    if (!page) return null;
    return {
      title:       page.seoTitle ?? page.title ?? undefined,
      description: page.seoDescription ?? undefined,
      ogImage:     page.ogImage ?? undefined,
    };
  } catch {
    return null;
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};

  const pathKey = slug.join('/');
  const inRegistry = PAGE_REGISTRY[pathKey];
  const isService = SERVICE_SLUGS.has(pathKey);
  const isStatic  = Boolean(STATIC_PAGE_MAP[pathKey]);

  if (!inRegistry && !isService && !isStatic) return {};

  const canonicalPath = `/${pathKey}`;
  const pageUrl = `${SITE.siteUrl}/${lang}${canonicalPath}`;

  // Try DB metadata for service pages first
  let title: string | undefined;
  let description: string | undefined;
  let ogImages: (typeof SITE.ogImage | string)[] = [SITE.ogImage];

  if (isService) {
    const dbMeta = await getDbMeta(pathKey, lang);
    if (!dbMeta) {
      // No published translation for this service page in this locale —
      // return noindex so Google doesn't index fallback/missing content.
      return { robots: { index: false, follow: false } };
    }
    title       = dbMeta.title;
    description = dbMeta.description;
    if (dbMeta.ogImage) {
      const abs = dbMeta.ogImage.startsWith('http') ? dbMeta.ogImage : `${SITE.siteUrl}${dbMeta.ogImage}`;
      ogImages = [abs];
    }
  }

  // Fall back to page-meta.json
  if (!title) {
    const meta = PAGE_META[pathKey]?.[lang];
    title       = meta?.title ?? 'VIP Transfer Istanbul';
    description = description ?? meta?.description;
  }

  // For service pages: only emit hreflang for languages with a published
  // DB translation so we never advertise a URL that serves fallback content.
  // For static non-service pages the locale routes always exist, so we
  // include all supported languages.
  let publishedLangs: string[];
  if (isService) {
    const { getPublishedServicePageLangs } = await import('@/lib/service-page-cms');
    publishedLangs = await getPublishedServicePageLangs(pathKey);
  } else {
    publishedLangs = [...SUPPORTED_LANGS];
  }
  const alternates = await buildAlternates(canonicalPath, publishedLangs);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
      languages: alternates.languages,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'website',
      images: ogImages,
    },
    robots: { index: true, follow: true },
  };
}

// ── Page component ────────────────────────────────────────────────────────
export default async function LocalizedPassthrough({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();

  const pathKey = slug.join('/');

  // Validate route exists
  const inRegistry = PAGE_REGISTRY[pathKey];
  const isService  = SERVICE_SLUGS.has(pathKey);
  const StaticPage = STATIC_PAGE_MAP[pathKey];

  if (!inRegistry && !isService && !StaticPage) notFound();

  const schemaType = inRegistry?.schemaType ?? (isService ? 'Service' : 'WebPage');
  const meta       = PAGE_META[pathKey]?.[lang];
  const pageUrl    = `${SITE.siteUrl}/${lang}/${pathKey}`;

  // For SERVICE pages, also get DB metadata for JSON-LD
  let jsonLdTitle = meta?.title ?? 'VIP Transfer Istanbul';
  let jsonLdDesc  = meta?.description;
  if (isService) {
    const dbMeta = await getDbMeta(pathKey, lang).catch(() => null);
    if (dbMeta?.title)       jsonLdTitle = dbMeta.title;
    if (dbMeta?.description) jsonLdDesc  = dbMeta.description;
  }

  const jsonLd =
    schemaType === 'Service'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: jsonLdTitle,
          description: jsonLdDesc,
          url: pageUrl,
          inLanguage: lang,
          provider: {
            '@type': 'LocalBusiness',
            name: 'VIP Transfer Istanbul',
            url: SITE.siteUrl,
            telephone: SITE.phoneE164,
            email: SITE.email,
          },
          areaServed: { '@type': 'City', name: 'İstanbul' },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: jsonLdTitle,
          description: jsonLdDesc,
          url: pageUrl,
          inLanguage: lang,
          publisher: {
            '@type': 'Organization',
            name: 'VIP Transfer Istanbul',
            url: SITE.siteUrl,
            telephone: SITE.phoneE164,
            email: SITE.email,
          },
        };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VIP Transfer Istanbul', item: SITE.siteUrl },
      { '@type': 'ListItem', position: 2, name: jsonLdTitle, item: pageUrl },
    ],
  };

  const scripts = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    </>
  );

  // SERVICE pages — rendered via DB-aware ServicePageRenderer
  if (isService) {
    const { default: ServicePageRenderer } = await import('@/components/ServicePageRenderer');
    return (
      <>
        <ServicePageRenderer slug={pathKey} lang={lang} />
        {scripts}
      </>
    );
  }

  // Non-service static page
  const Page = StaticPage;
  if (!Page) notFound();

  return (
    <>
      <Page />
      {scripts}
    </>
  );
}
