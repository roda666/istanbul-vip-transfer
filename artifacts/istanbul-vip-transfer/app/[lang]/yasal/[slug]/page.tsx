/**
 * Localized legal page route.
 * URL: /[lang]/yasal/[slug]  e.g. /en/yasal/kvkk-aydinlatma-metni
 */
import type { Metadata } from 'next';
import { notFound }       from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import {
  getLegalPage,
  getLegalPageTranslation,
  isLegalSlug,
  LEGAL_SLUGS,
} from '@/lib/legal-page-cms';
import LegalPageRenderer  from '@/components/LegalPageRenderer';
import { SITE }           from '@/lib/site-config';
import { getOgLocale }    from '@/lib/i18n/seo';

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export function generateStaticParams() {
  const params: Array<{ lang: string; slug: string }> = [];
  for (const lang of SUPPORTED_LANGS) {
    for (const slug of LEGAL_SLUGS) {
      params.push({ lang, slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || !isLegalSlug(slug)) return {};

  const page = await getLegalPageTranslation(slug, lang) ?? await getLegalPage(slug);
  if (!page) return {};

  const canonical = `${SITE.siteUrl}/yasal/${slug}`;
  const pageUrl   = `${SITE.siteUrl}/${lang}/yasal/${slug}`;
  const languages: Record<string, string> = { 'tr': canonical };
  for (const l of SUPPORTED_LANGS) {
    languages[l] = `${SITE.siteUrl}/${l}/yasal/${slug}`;
  }

  return {
    title:       `${page.title} | Istanbul VIP Transfer`,
    description: page.excerpt,
    alternates:  { canonical, languages },
    openGraph: {
      title:       `${page.title} | Istanbul VIP Transfer`,
      description: page.excerpt,
      url:         pageUrl,
      siteName:    'Istanbul VIP Transfer',
      locale:      getOgLocale(lang),
      type:        'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function LegalPageLocalized({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang) || !isLegalSlug(slug)) notFound();

  // Prefer translated version; fall back to Turkish source
  const page = await getLegalPageTranslation(slug, lang) ?? await getLegalPage(slug);
  if (!page) notFound();

  return <LegalPageRenderer page={page} lang={lang} />;
}
