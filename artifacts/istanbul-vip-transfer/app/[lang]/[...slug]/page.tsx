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
import { notFound, permanentRedirect } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, buildServiceAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';
import rawPageMeta from '@/lib/page-meta.json';
import { PAGE_REGISTRY } from '@/lib/page-registry';
import { STATIC_PAGE_SLUGS } from '@/lib/static-page-slugs';
import { localizedServicePath, resolveLocalizedServiceSlug } from '@/lib/localized-service-path';

// ── Turkish page components (non-SERVICE pages use these directly) ─────────
import HizmetlerPage     from '@/app/hizmetler/page';
import AraclarPage       from '@/app/araclar/page';
import VehiclesPageContent from '@/components/VehiclesPageContent';
import HakkimizdaPage    from '@/app/hakkimizda/page';
import IletisimPage      from '@/app/iletisim/page';

// ── Non-service static pages ─────────────────────────────────────────────
// When adding a new WebPage slug:
//   1. Import the component above.
//   2. Add it to STATIC_PAGE_MAP below.
//   3. Add the slug to lib/static-page-slugs.ts.
//   4. Add the entry to PAGE_REGISTRY in lib/page-registry.ts.
// `check:page-meta` (prebuild) will catch a mismatch before it ships.
const STATIC_PAGE_MAP: Record<string, React.ComponentType> = {
  'hizmetler':  HizmetlerPage,
  'araclar':    AraclarPage,
  'hakkimizda': HakkimizdaPage,
  'iletisim':   IletisimPage,
};

// ── Build-time / startup guard ────────────────────────────────────────────
// Verify STATIC_PAGE_MAP and lib/static-page-slugs.ts are in sync.
// This throws at module load time (caught by both `next build` and `next dev`
// startup), giving an explicit error instead of a silent blank page.
(function assertComponentCoverage() {
  const missing = STATIC_PAGE_SLUGS.filter((slug) => !(slug in STATIC_PAGE_MAP));
  const extra   = Object.keys(STATIC_PAGE_MAP).filter(
    (slug) => !STATIC_PAGE_SLUGS.includes(slug),
  );
  if (missing.length > 0 || extra.length > 0) {
    const lines: string[] = [
      'STATIC_PAGE_MAP and lib/static-page-slugs.ts are out of sync:',
    ];
    if (missing.length > 0)
      lines.push(`  Missing components for: ${missing.join(', ')}`);
    if (extra.length > 0)
      lines.push(`  Extra STATIC_PAGE_MAP entries not in static-page-slugs.ts: ${extra.join(', ')}`);
    lines.push(
      'Fix: keep STATIC_PAGE_MAP, lib/static-page-slugs.ts, and PAGE_REGISTRY in sync.',
    );
    throw new Error(lines.join('\n'));
  }
})();

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

  const requestedPath = slug.join('/');
  const serviceSlug = resolveLocalizedServiceSlug(requestedPath, lang);
  const pathKey = serviceSlug ?? requestedPath;
  const inRegistry = PAGE_REGISTRY[pathKey];
  const isService = serviceSlug !== null;
  const isStatic  = Boolean(STATIC_PAGE_MAP[requestedPath]);

  if (!inRegistry && !isService && !isStatic) return {};

  const canonicalPath = isService
    ? localizedServicePath(pathKey, lang)
    : `/${lang}/${requestedPath}`;
  const pageUrl = `${SITE.siteUrl}${canonicalPath}`;

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
  const alternates = isService
    ? await buildServiceAlternates(pathKey, publishedLangs)
    : await buildAlternates(`/${requestedPath}`, publishedLangs);

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

  const requestedPath = slug.join('/');
  const serviceSlug = resolveLocalizedServiceSlug(requestedPath, lang);
  const pathKey = serviceSlug ?? requestedPath;
  const cs = await getContactSettings();

  // Validate route exists
  const inRegistry = PAGE_REGISTRY[pathKey];
  const isService  = serviceSlug !== null;
  const StaticPage = STATIC_PAGE_MAP[requestedPath];

  if (!inRegistry && !isService && !StaticPage) notFound();

  // Legacy locale-prefixed Turkish service slugs are redirected to the
  // localized canonical URL so shared/indexed links stay valid without
  // producing duplicate pages.
  if (isService) {
    const localizedPath = localizedServicePath(pathKey, lang);
    if (`/${lang}/${requestedPath}` !== localizedPath) {
      permanentRedirect(localizedPath);
    }
  }

  const schemaType = inRegistry?.schemaType ?? (isService ? 'Service' : 'WebPage');
  const meta       = PAGE_META[pathKey]?.[lang];
  const pageUrl    = `${SITE.siteUrl}${isService ? localizedServicePath(pathKey, lang) : `/${lang}/${requestedPath}`}`;

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
            telephone: cs.phoneE164,
            email: cs.email,
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
            telephone: cs.phoneE164,
            email: cs.email,
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

  // safeJsonLd: escapes </script> and Unicode line/paragraph separators so
  // admin-controlled title/description values cannot inject arbitrary markup.
  const safeJsonLd = (obj: unknown) =>
    JSON.stringify(obj)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  const scripts = (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
    </>
  );

  // SERVICE pages — rendered via DB-aware ServicePageRenderer
  if (isService) {
    const { default: ServicePageRenderer } = await import('@/components/ServicePageRenderer');
    return (
      <>
        <ServicePageRenderer slug={pathKey} lang={lang} canonicalPath={localizedServicePath(pathKey, lang)} />
        {scripts}
      </>
    );
  }

  // Non-service static page
  const Page = StaticPage;
  if (!Page) notFound();

  return (
    <>
      {pathKey === 'araclar' ? <VehiclesPageContent locale={lang} /> : <Page />}
      {scripts}
    </>
  );
}
