/**
 * SEO helpers for multilingual pages.
 * Generates canonical URL, hreflang alternates, and Open Graph locale.
 */
import { SITE } from '@/lib/site-config';
import { SUPPORTED_LANGS, LANG_LOCALES, type SiteLang } from './index';

export interface HreflangEntry {
  hrefLang: string;
  href: string;
}

interface AlternatesResult {
  canonical: string;
  languages: Record<string, string>;
}

/**
 * Builds the full alternate/canonical object for Next.js `metadata.alternates`.
 *
 * @param path - The canonical path, WITHOUT lang prefix (e.g. '/blog/my-slug').
 *               Pass '/' for the homepage.
 * @param publishedLangs - Target lang codes that have a PUBLISHED translation.
 *                         Turkish (root) is always included.
 */
export function buildAlternates(path: string, publishedLangs: string[] = []): AlternatesResult {
  const base = SITE.siteUrl;
  const canonical = `${base}${path === '/' ? '' : path}`;

  const languages: Record<string, string> = {};

  // x-default always points to Turkish root
  languages['x-default'] = canonical;

  // Turkish is always present (it's the source)
  languages[LANG_LOCALES.tr] = canonical;

  // Add entries for each published translation
  for (const lang of publishedLangs) {
    if (lang === 'tr') continue;
    const locale = LANG_LOCALES[lang as SiteLang];
    if (!locale) continue;
    const translatedPath = path === '/' ? `/${lang}` : `/${lang}${path}`;
    languages[locale] = `${base}${translatedPath}`;
  }

  return { canonical, languages };
}

/**
 * Returns the Open Graph locale string for a given language code.
 */
export function getOgLocale(lang: string): string {
  return LANG_LOCALES[lang as SiteLang] ?? LANG_LOCALES.tr;
}

/**
 * Returns alternate locales (all supported locales except current) for OG.
 */
export function getOgAlternateLocales(currentLang: string): string[] {
  return (['tr', ...SUPPORTED_LANGS] as SiteLang[])
    .filter((l) => l !== currentLang)
    .map((l) => LANG_LOCALES[l]);
}
