/**
 * i18n entry point — exports getDictionary, type helpers, and supported lang codes.
 */
import type { Dictionary } from './types';
import tr from './dictionaries/tr';
import en from './dictionaries/en';
import de from './dictionaries/de';
import ru from './dictionaries/ru';
import ar from './dictionaries/ar';

/** Language codes for non-default (non-Turkish) languages. */
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

/** Returns true if `lang` is a valid non-default target language code. */
export function isValidLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

/** Returns the text direction for a given language code. */
export function getLangDir(lang: string): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Converts a language code to its BCP 47 locale string. */
export const LANG_LOCALES: Record<SiteLang, string> = {
  tr: 'tr-TR',
  en: 'en-GB',
  de: 'de-DE',
  ru: 'ru-RU',
  ar: 'ar-SA',
};

/** Native language names for the language selector. */
export const LANG_NATIVE_NAMES: Record<SiteLang, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
};

export type { Dictionary };
