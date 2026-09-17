import 'server-only';

import { AUTO_TRANSLATION_LOCALES, syncStructuralTranslations, type LocaleTranslationMap } from '@/lib/ai/fill-missing-translations';
import { getPublicLanguages } from '@/lib/i18n/active-locales';
import { findTollFeeViolations } from '@/lib/toll-fee-rules';

export const ROUTE_TRANSLATION_FIELDS = [
  'title',
  'description',
  'seoTitle',
  'seoDescription',
  'ogTitle',
  'ogDescription',
  'introParagraph',
  'origin',
  'destination',
] as const;

export type RouteTranslationSource = Record<typeof ROUTE_TRANSLATION_FIELDS[number], string | null | undefined>;

function assertSafe(value: string | null | undefined, locale: string, field: string): void {
  if (findTollFeeViolations(value, locale).length > 0) {
    throw new Error(`${locale.toUpperCase()} rota çevirisi geçiş ücreti güvenlik kontrolünden geçemedi: ${field}`);
  }
}

export async function translateRouteTextFields(
  source: RouteTranslationSource,
  existing: LocaleTranslationMap = {},
): Promise<LocaleTranslationMap> {
  assertSafe(source.title, 'tr', 'title');
  assertSafe(source.description, 'tr', 'description');
  assertSafe(source.introParagraph, 'tr', 'introParagraph');

  const activeLocales = (await getPublicLanguages())
    .map((language) => language.code)
    .filter((code) =>
      code !== 'tr'
      && (AUTO_TRANSLATION_LOCALES as readonly string[]).includes(code),
    );
  const translated = await syncStructuralTranslations(
    source,
    existing,
    ROUTE_TRANSLATION_FIELDS,
    activeLocales,
  );
  for (const locale of activeLocales) {
    for (const field of ROUTE_TRANSLATION_FIELDS) {
      assertSafe(translated[locale]?.[field], locale, field);
    }
  }
  return translated;
}