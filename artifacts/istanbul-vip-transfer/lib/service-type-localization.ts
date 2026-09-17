import 'server-only';

import {
  AUTO_TRANSLATION_LOCALES,
  syncStructuralTranslations,
  type LocaleTranslationMap,
} from '@/lib/ai/fill-missing-translations';
import { getPublicLanguages } from '@/lib/i18n/active-locales';
import { findTollFeeViolations } from '@/lib/toll-fee-rules';

export type ServiceTypeTranslations = Record<string, {
  label?: string;
  description?: string | null;
}>;

function assertSafe(text: string | null | undefined, locale: string): void {
  if (findTollFeeViolations(text, locale).length > 0) {
    throw new Error(`${locale.toUpperCase()} müşteri metni geçiş ücreti güvenlik kontrolünden geçemedi.`);
  }
}

export function localizeServiceType<T extends {
  label: string;
  description: string | null;
  translations?: ServiceTypeTranslations | null;
}>(row: T, locale: string): Omit<T, 'translations'> {
  const { translations, ...rest } = row;
  const translated = translations?.[locale];
  return {
    ...rest,
    label: translated?.label?.trim() || row.label,
    description: translated?.description?.trim() || row.description,
  };
}

export async function syncServiceTypeTranslations(input: {
  label: string;
  description: string | null;
  existing?: ServiceTypeTranslations | null;
  changedFields: readonly ('label' | 'description')[];
}): Promise<ServiceTypeTranslations> {
  assertSafe(input.label, 'tr');
  assertSafe(input.description, 'tr');

  const activeCodes = (await getPublicLanguages())
    .map((language) => language.code)
    .filter((code) =>
      code !== 'tr' && (AUTO_TRANSLATION_LOCALES as readonly string[]).includes(code));

  const translated = await syncStructuralTranslations(
    { label: input.label, description: input.description },
    (input.existing ?? {}) as LocaleTranslationMap,
    input.changedFields,
    activeCodes,
  );

  for (const locale of activeCodes) {
    assertSafe(translated[locale]?.label, locale);
    assertSafe(translated[locale]?.description, locale);
  }
  return translated as ServiceTypeTranslations;
}

export function serviceTypeKeyFromLabel(label: string): string {
  const normalized = label
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/İ/g, 'I')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  if (!normalized) throw new Error('Hizmet türü için geçerli bir sistem anahtarı üretilemedi.');
  return normalized;
}