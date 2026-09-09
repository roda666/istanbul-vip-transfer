import { describe, expect, it, vi } from 'vitest';

import {
  AUTO_TRANSLATION_LOCALES,
  fieldLocaleMaps,
  fillMissingTranslations,
  localeFieldMap,
} from '../../lib/ai/fill-missing-translations';

const { translateServicePageFields } = vi.hoisted(() => ({
  translateServicePageFields: vi.fn(
    async (fields: Record<string, string>, locale: string) => ({
      ok: true as const,
      translated: {
        ...Object.fromEntries(
        Object.entries(fields).map(([field, value]) => [field, `${locale}:${value}`]),
        ),
        // Simulate a model that returns an unrequested field.
        ...(!Object.prototype.hasOwnProperty.call(fields, 'heading')
          ? { heading: `ai-override-${locale}` }
          : {}),
      },
    }),
  ),
}));

vi.mock('../../lib/ai/translate-service-page', () => ({
  translateServicePageFields,
}));

describe('fillMissingTranslations', () => {
  it('preserves existing and manually entered values for every target locale', async () => {
    const existing = Object.fromEntries(
      AUTO_TRANSLATION_LOCALES.map((locale) => [
        locale,
        {
          heading: `manual-${locale}`,
          description: `saved-${locale}`,
          seoTitle: `seo-${locale}`,
        },
      ]),
    );

    const result = await fillMissingTranslations(
      {
        heading: 'Türkçe başlık',
        description: 'Türkçe açıklama',
        seoTitle: 'Türkçe SEO başlığı',
        seoDescription: 'Türkçe SEO açıklaması',
      },
      existing,
    );

    for (const locale of AUTO_TRANSLATION_LOCALES) {
      expect(result[locale]).toMatchObject({
        heading: `manual-${locale}`,
        description: `saved-${locale}`,
        seoTitle: `seo-${locale}`,
        seoDescription: `${locale}:Türkçe SEO açıklaması`,
      });
    }

    expect(translateServicePageFields).toHaveBeenCalledTimes(AUTO_TRANSLATION_LOCALES.length);
    for (const [fields] of translateServicePageFields.mock.calls) {
      expect(fields).not.toHaveProperty('heading');
      expect(fields).not.toHaveProperty('description');
      expect(fields).not.toHaveProperty('seoTitle');
      expect(fields).toEqual({ seoDescription: 'Türkçe SEO açıklaması' });
    }
  });

  it('does not replace blank values with a translation when the source is also blank', async () => {
    const result = await fillMissingTranslations(
      { heading: 'Türkçe başlık', empty: '', whitespace: '   ' },
      { en: { heading: '', empty: '', whitespace: '' } },
    );

    expect(result.en).toEqual({
      heading: 'en:Türkçe başlık',
      empty: '',
      whitespace: '',
    });
    for (const locale of AUTO_TRANSLATION_LOCALES.filter((locale) => locale !== 'en')) {
      expect(result[locale]).toEqual({ heading: `${locale}:Türkçe başlık` });
    }
  });
});

describe('vehicle translation locale-map helpers', () => {
  it('keeps every existing vehicle field translation while filling only missing slots', () => {
    const existingMaps = {
      name: Object.fromEntries(AUTO_TRANSLATION_LOCALES.map((locale) => [locale, `name-${locale}`])),
      shortDescription: { en: 'manual-short-en', de: 'manual-short-de' },
      fullDescription: { ar: 'manual-full-ar' },
      tagline: {},
    };

    const perLocale = localeFieldMap(existingMaps);
    expect(perLocale.en.name).toBe('name-en');
    expect(perLocale.en.shortDescription).toBe('manual-short-en');
    expect(perLocale.ar.fullDescription).toBe('manual-full-ar');
    expect(perLocale.it.fullDescription).toBe('');

    const completed = fieldLocaleMaps(
      {
        en: {
          name: 'generated-name-en',
          shortDescription: 'generated-short-en',
          fullDescription: 'generated-full-en',
          tagline: 'generated-tagline-en',
        },
        ar: {
          name: 'generated-name-ar',
          shortDescription: 'generated-short-ar',
          fullDescription: 'generated-full-ar',
          tagline: 'generated-tagline-ar',
        },
      },
      ['name', 'shortDescription', 'fullDescription', 'tagline'],
      existingMaps,
    );

    expect(completed.name.en).toBe('name-en');
    expect(completed.shortDescription.en).toBe('manual-short-en');
    expect(completed.fullDescription.ar).toBe('manual-full-ar');
    expect(completed.fullDescription.en).toBe('generated-full-en');
    expect(completed.tagline.en).toBe('generated-tagline-en');
  });
});