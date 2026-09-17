import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/active-locales', () => ({
  getPublicLanguages: vi.fn(async () => [
    { code: 'tr' }, { code: 'en' }, { code: 'de' }, { code: 'ru' },
    { code: 'ar' }, { code: 'fr' }, { code: 'es' }, { code: 'it' }, { code: 'nl' },
  ]),
}));
vi.mock('@/lib/ai/fill-missing-translations', () => ({
  AUTO_TRANSLATION_LOCALES: ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'],
  syncStructuralTranslations: vi.fn(async (source: Record<string, string | null>, existing: Record<string, Record<string, string>>) => {
    const result = { ...existing };
    for (const locale of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
      result[locale] = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value ? `${locale.toUpperCase()} ${value}` : null]));
    }
    return result;
  }),
}));

import { translateRouteTextFields } from '@/lib/transfer-route-localization';

describe('transfer route localization', () => {
  it('regenerates every active locale from Turkish source fields', async () => {
    const result = await translateRouteTextFields({
      title: 'Taksim - Havalimanı',
      description: 'Gerçek rota açıklaması.',
      seoTitle: 'Taksim Havalimanı Transferi',
      seoDescription: 'Konforlu transfer.',
      ogTitle: 'Taksim Transfer',
      ogDescription: 'VIP transfer.',
      introParagraph: 'Rota bilgisi.',
      origin: 'Taksim',
      destination: 'İstanbul Havalimanı',
    }, {
      en: { title: 'STALE LOCKED TITLE', description: 'STALE' },
      de: { title: 'STALE TITLE', description: 'STALE' },
    });
    expect(result.en.title).toBe('EN Taksim - Havalimanı');
    expect(result.de.description).toBe('DE Gerçek rota açıklaması.');
    expect(result.ru.title).toBe('RU Taksim - Havalimanı');
    expect(result.nl.description).toBe('NL Gerçek rota açıklaması.');
  });

  it('rejects unsafe Turkish customer copy before translation', async () => {
    await expect(translateRouteTextFields({
      title: 'Köprü geçiş ücreti dahil rota',
      description: null,
      seoTitle: null,
      seoDescription: null,
      ogTitle: null,
      ogDescription: null,
      introParagraph: null,
      origin: 'A',
      destination: 'B',
    })).rejects.toThrow(/güvenlik kontrolünden/);
  });
});