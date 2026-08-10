/**
 * Locale-prefixed passthrough for Turkish content pages.
 *
 * Handles routes like /en/hizmetler, /de/istanbul-havalimani-transfer, etc.
 * The parent [lang]/layout.tsx already wraps children in <LangProvider forceLang={lang}>,
 * and PublicLayoutWrapper's outer LangProvider detects the lang from the URL pathname.
 * This means Header, Footer, and all client components automatically render in the
 * correct language even though the page content is Turkish.
 *
 * SEO: generateMetadata emits full Open Graph, hreflang alternates, and JSON-LD
 * (Service or WebPage) so AI crawlers and search engines understand each page's
 * content type, language, and publisher.
 *
 * NOTE: The param is named `slug` to match app/[lang]/blog/[slug]/page.tsx.
 * Next.js requires overlapping catch-all and named dynamic segments use the same name.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import rawPageMeta from '@/lib/page-meta.json';
import { PAGE_REGISTRY } from '@/lib/page-registry';

// ── Turkish page components ─────────────────────────────────────────────────
import HizmetlerPage          from '@/app/hizmetler/page';
import AraclarPage            from '@/app/araclar/page';
import HakkimizdaPage         from '@/app/hakkimizda/page';
import IletisimPage           from '@/app/iletisim/page';
import IstHavaPage            from '@/app/istanbul-havalimani-transfer/page';
import SabihaPage             from '@/app/sabiha-gokcen-havalimani-transfer/page';
import VipTransferPage        from '@/app/vip-transfer/page';
import SehirlerArasiPage      from '@/app/sehirler-arasi-transfer/page';
import SoforluPage            from '@/app/soforlu-arac-kiralama/page';
import OtelPage               from '@/app/otel-transfer/page';
import SaglikPage             from '@/app/saglik-turizmi-transfer/page';
import KurumPage              from '@/app/kurumsal-vip-transfer/page';
import IstBursaPage           from '@/app/istanbul-bursa-transfer/page';
import IstSapancaPage         from '@/app/istanbul-sapanca-transfer/page';
import IstGunubirlikPage      from '@/app/istanbul-gunubirlik-turlar/page';
import SapancaPage            from '@/app/sapanca-masukiye-turu/page';
import BursaPage              from '@/app/bursa-gunubirlik-tur/page';
import YalovaPage             from '@/app/yalova-gunubirlik-tur/page';

// ── Route map ───────────────────────────────────────────────────────────────
const PAGE_MAP: Record<string, React.ComponentType> = {
  'hizmetler':                         HizmetlerPage,
  'araclar':                           AraclarPage,
  'hakkimizda':                        HakkimizdaPage,
  'iletisim':                          IletisimPage,
  'istanbul-havalimani-transfer':      IstHavaPage,
  'sabiha-gokcen-havalimani-transfer': SabihaPage,
  'vip-transfer':                      VipTransferPage,
  'sehirler-arasi-transfer':           SehirlerArasiPage,
  'soforlu-arac-kiralama':             SoforluPage,
  'otel-transfer':                     OtelPage,
  'saglik-turizmi-transfer':           SaglikPage,
  'kurumsal-vip-transfer':             KurumPage,
  'istanbul-bursa-transfer':           IstBursaPage,
  'istanbul-sapanca-transfer':         IstSapancaPage,
  'istanbul-gunubirlik-turlar':        IstGunubirlikPage,
  'sapanca-masukiye-turu':             SapancaPage,
  'bursa-gunubirlik-tur':              BursaPage,
  'yalova-gunubirlik-tur':             YalovaPage,
};

// ── Page metadata (translated) ──────────────────────────────────────────────
// Loaded from lib/page-meta.json — generated/updated via:
//   pnpm generate:page-meta   (reads lib/page-registry.ts as source of truth)
// The prebuild step (check:page-meta) enforces full coverage before every build.
type LangMeta = Record<string, { title: string; description: string }>;
const PAGE_META: Record<string, LangMeta> = rawPageMeta as Record<string, LangMeta>;

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  params: Promise<{ lang: string; slug: string[] }>;
}

// ── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};

  const pathKey = slug.join('/');
  // Both PAGE_REGISTRY and COMPONENT_MAP must have the slug; registry is the authority.
  if (!PAGE_REGISTRY[pathKey] || !PAGE_MAP[pathKey]) return {};

  const meta = PAGE_META[pathKey]?.[lang];
  const title = meta?.title ?? 'VIP Transfer Istanbul';
  const description = meta?.description ?? undefined;

  // Canonical is the Turkish root path; this page is the lang-prefixed alternate.
  const canonicalPath = `/${pathKey}`;
  const pageUrl = `${SITE.siteUrl}/${lang}${canonicalPath}`;

  // All supported langs have static dictionaries → always published.
  const alternates = await buildAlternates(canonicalPath, [...SUPPORTED_LANGS]);

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
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

// ── Page component ───────────────────────────────────────────────────────────
export default async function LocalizedPassthrough({ params }: Props) {
  const { lang, slug } = await params;

  if (!isValidLang(lang)) notFound();

  const pathKey = slug.join('/');
  const Page = PAGE_MAP[pathKey];

  if (!Page || !PAGE_REGISTRY[pathKey]) notFound();

  // Build JSON-LD for this locale-prefixed page.
  // schemaType comes from PAGE_REGISTRY — the single source of truth.
  const schemaType = PAGE_REGISTRY[pathKey].schemaType;
  const meta = PAGE_META[pathKey]?.[lang];
  const pageUrl = `${SITE.siteUrl}/${lang}/${pathKey}`;

  const jsonLd =
    schemaType === 'Service'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: meta?.title ?? 'VIP Transfer Istanbul',
          description: meta?.description,
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
          name: meta?.title ?? 'VIP Transfer Istanbul',
          description: meta?.description,
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
      { '@type': 'ListItem', position: 2, name: meta?.title ?? pathKey, item: pageUrl },
    ],
  };

  return (
    <>
      <Page />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}
