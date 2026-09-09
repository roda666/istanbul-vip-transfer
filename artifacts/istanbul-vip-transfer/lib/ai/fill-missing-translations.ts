import 'server-only';
import { translateServicePageFields } from './translate-service-page';

export const AUTO_TRANSLATION_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
export type AutoTranslationLocale = typeof AUTO_TRANSLATION_LOCALES[number];
export type TranslationFields = Record<string, string | null | undefined>;
export type LocaleTranslationMap = Record<string, Record<string, string | null | undefined>>;

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Fill only missing translated values. Existing values are never changed,
 * which makes a manually edited value an implicit durable lock.
 */
export async function fillMissingTranslations(
  source: TranslationFields,
  existing: LocaleTranslationMap = {},
): Promise<LocaleTranslationMap> {
  const result: LocaleTranslationMap = structuredClone(existing);

  await Promise.all(AUTO_TRANSLATION_LOCALES.map(async (locale) => {
    const current = { ...(result[locale] ?? {}) };
    const missing = Object.fromEntries(
      Object.entries(source).filter(([key, value]) => present(value) && !present(current[key])),
    ) as Record<string, string>;
    if (Object.keys(missing).length === 0) return;

    const translated = await translateServicePageFields(missing, locale);
    if (!translated.ok) {
      throw new Error(`${locale.toUpperCase()} otomatik çevirisi üretilemedi: ${translated.message ?? translated.reason}`);
    }
    // The model is instructed to return exactly the requested keys, but do not
    // let an extra or hallucinated key bypass the missing-only contract.
    const safeTranslated = Object.fromEntries(
      Object.keys(missing)
        .filter((key) => Object.prototype.hasOwnProperty.call(translated.translated, key))
        .map((key) => [key, translated.translated[key]]),
    );
    result[locale] = { ...current, ...safeTranslated };
  }));

  return result;
}

export function localeFieldMap(
  maps: Record<string, Record<string, string> | null | undefined>,
): LocaleTranslationMap {
  const result: LocaleTranslationMap = {};
  for (const locale of AUTO_TRANSLATION_LOCALES) {
    result[locale] = Object.fromEntries(
      Object.entries(maps).map(([field, values]) => [field, values?.[locale] ?? '']),
    );
  }
  return result;
}

export function fieldLocaleMaps(
  translations: LocaleTranslationMap,
  fields: string[],
  existing: Record<string, Record<string, string> | null | undefined> = {},
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const field of fields) {
    result[field] = { ...(existing[field] ?? {}) };
    for (const locale of AUTO_TRANSLATION_LOCALES) {
      const value = translations[locale]?.[field];
      if (present(value) && !present(result[field][locale])) result[field][locale] = value;
    }
  }
  return result;
}