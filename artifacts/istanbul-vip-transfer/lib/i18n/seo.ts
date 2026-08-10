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
 * Async and catalog-aware: hreflang entries are emitted only for languages
 * that are in the PUBLIC locale set (enabled + published + renderable), so a
 * passive or unrenderable catalog language can never leak into hreflang.
 *
 * @param path - The canonical path, WITHOUT lang prefix (e.g. '/blog/my-slug').
 *               Pass '/' for the homepage.
 * @param publishedLangs - Target lang codes that have a PUBLISHED translation.
 *                         Turkish (root) is always included.
 */
export async function buildAlternates(path: string, publishedLangs: string[] = []): Promise<AlternatesResult> {
  const base = SITE.siteUrl;
  const canonical = `${base}${path === '/' ? '' : path}`;

  const languages: Record<string, string> = {};

  // x-default always points to Turkish root
  languages['x-default'] = canonical;

  // Turkish is always present (it's the source)
  languages[LANG_LOCALES.tr] = canonical;

  // Public locale set — single source of truth (DB, with static fallback)
  const { getPublicLanguages } = await import('./active-locales');
  const publicLangs = await getPublicLanguages();

  // Add entries for each published translation that is also publicly active
  for (const lang of publishedLangs) {
    if (lang === 'tr') continue;
    const entry = publicLangs.find((l) => l.code === lang);
    if (!entry) continue;
    const translatedPath = path === '/' ? `/${lang}` : `/${lang}${path}`;
    languages[entry.locale] = `${base}${translatedPath}`;
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
