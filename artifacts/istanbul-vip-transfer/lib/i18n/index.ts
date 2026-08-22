/**
 * i18n entry point — exports getDictionary, type helpers, and supported lang codes.
 *
 * SUPPORTED_LANGS reflects every language that has a complete static UI dictionary.
 * The full 9-locale registry lives in locale-registry.ts; import from there for
 * routing, middleware, and SEO concerns.
 */
import type { Dictionary } from './types';
import tr from './dictionaries/tr';
import en from './dictionaries/en';
import de from './dictionaries/de';
import ru from './dictionaries/ru';
import ar from './dictionaries/ar';
import es from './dictionaries/es';
import fr from './dictionaries/fr';
import it from './dictionaries/it';
import nl from './dictionaries/nl';

import {
  LOCALE_REGISTRY,
  LOCALE_BCP47,
  LOCALE_NATIVE_NAMES,
  RTL_LOCALES,
  isLocaleCodeSyntax,
} from './locale-registry';

/**
 * Language codes for non-default (non-Turkish) languages that have complete
 * static UI dictionaries.  All 8 non-TR registry locales now qualify.
 */
export const SUPPORTED_LANGS = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** All site languages including the default Turkish. */
export const ALL_LANGS = ['tr', ...SUPPORTED_LANGS] as const;
export type SiteLang = (typeof ALL_LANGS)[number];

const DICTS: Record<SiteLang, Dictionary> = { tr, en, de, ru, ar, es, fr, it, nl };

/** Returns a static UI dictionary without exposing Turkish to an unknown locale. */
export function getDictionary(lang: string): Dictionary {
  return DICTS[lang as SiteLang] ?? DICTS.en;
}

/**
 * Returns true for a route-safe non-Turkish locale code. Public access is
 * separately enforced by the server layout against the language catalog; this
 * syntax check must not freeze routing to the original dictionary tuple.
 */
export function isValidLang(lang: string): boolean {
  return lang !== 'tr' && isLocaleCodeSyntax(lang);
}

/** Returns the text direction for a given language code. Derived from the registry. */
export function getLangDir(lang: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(lang) ? 'rtl' : 'ltr';
}

/**
 * BCP 47 locale strings for all dictionary-backed languages.
 * Populated from the registry — not duplicated here.
 */
export const LANG_LOCALES: Record<SiteLang, string> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, LOCALE_BCP47[l.code as keyof typeof LOCALE_BCP47] ?? l.locale]),
) as Record<SiteLang, string>;

/**
 * Native language names for all dictionary-backed languages.
 * Populated from the registry — not duplicated here.
 */
export const LANG_NATIVE_NAMES: Record<SiteLang, string> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, LOCALE_NATIVE_NAMES[l.code as keyof typeof LOCALE_NATIVE_NAMES] ?? l.nativeName]),
) as Record<SiteLang, string>;

export type { Dictionary };
