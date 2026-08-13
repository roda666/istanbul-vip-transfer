/**
 * i18n entry point — exports getDictionary, type helpers, and supported lang codes.
 *
 * SUPPORTED_LANGS reflects only the languages that have complete static UI
 * dictionaries.  The full 9-locale registry lives in locale-registry.ts;
 * import from there for routing, middleware, and SEO concerns.
 */
import type { Dictionary } from './types';
import tr from './dictionaries/tr';
import en from './dictionaries/en';
import de from './dictionaries/de';
import ru from './dictionaries/ru';
import ar from './dictionaries/ar';

import {
  LOCALE_BCP47,
  LOCALE_NATIVE_NAMES,
  RTL_LOCALES,
} from './locale-registry';

/**
 * Language codes for non-default (non-Turkish) languages that have complete
 * static UI dictionaries.  Grows when task #103 ships es/fr/it/nl dictionaries.
 */
export const SUPPORTED_LANGS = ['en', 'de', 'ru', 'ar'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** All site languages including the default Turkish. */
export const ALL_LANGS = ['tr', ...SUPPORTED_LANGS] as const;
export type SiteLang = (typeof ALL_LANGS)[number];

const DICTS: Record<SiteLang, Dictionary> = { tr, en, de, ru, ar };

/** Returns the static UI dictionary for a given language code. Falls back to Turkish. */
export function getDictionary(lang: string): Dictionary {
  return DICTS[lang as SiteLang] ?? DICTS.tr;
}

/** Returns true if `lang` is a valid non-default target language code (has a dictionary). */
export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

/** Returns the text direction for a given language code. Derived from the registry. */
export function getLangDir(lang: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(lang) ? 'rtl' : 'ltr';
}

/**
 * BCP 47 locale strings for dictionary-backed languages.
 * Populated from the registry — not duplicated here.
 */
export const LANG_LOCALES: Record<SiteLang, string> = {
  tr: LOCALE_BCP47.tr,
  en: LOCALE_BCP47.en,
  de: LOCALE_BCP47.de,
  ru: LOCALE_BCP47.ru,
  ar: LOCALE_BCP47.ar,
};

/**
 * Native language names for dictionary-backed languages.
 * Populated from the registry — not duplicated here.
 */
export const LANG_NATIVE_NAMES: Record<SiteLang, string> = {
  tr: LOCALE_NATIVE_NAMES.tr,
  en: LOCALE_NATIVE_NAMES.en,
  de: LOCALE_NATIVE_NAMES.de,
  ru: LOCALE_NATIVE_NAMES.ru,
  ar: LOCALE_NATIVE_NAMES.ar,
};

export type { Dictionary };
