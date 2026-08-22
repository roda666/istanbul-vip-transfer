import { describe, expect, it } from 'vitest';
import { getPublicUiCopy } from '../../lib/i18n/public-ui';

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'] as const;
const TURKISH_MARKERS = [
  'Havalimanları',
  'İller',
  'İstanbul ilçeleri',
  'Yükleniyor…',
  'Sonuç bulunamadı',
  'Önceki araç',
  'Sonraki araç',
  'Seçimi temizle',
];

describe('public UI locale copy', () => {
  it.each(TARGET_LOCALES)('does not expose Turkish picker or carousel copy for %s', (locale) => {
    const copy = getPublicUiCopy(locale);
    const values = [
      copy.location.airport,
      copy.location.province,
      copy.location.district,
      copy.location.loading,
      copy.location.noResults,
      copy.location.clearSelection,
      copy.vehicles.previous,
      copy.vehicles.next,
      copy.vehicles.slide(1),
    ];

    expect(values).not.toContain('Havalimanları');
    expect(values).not.toContain('İller');
    expect(values).not.toContain('İstanbul ilçeleri');
    expect(values).not.toContain('Yükleniyor…');
    expect(values).not.toContain('Sonuç bulunamadı');
    expect(values).not.toContain('Önceki araç');
    expect(values).not.toContain('Sonraki araç');
    expect(values).not.toContain('Seçimi temizle');
    expect(values.some((value) => TURKISH_MARKERS.includes(value))).toBe(false);
  });

  it('keeps Turkish copy exclusive to Turkish and uses English as an unknown-locale fallback', () => {
    expect(getPublicUiCopy('tr').location.airport).toBe('Havalimanları');
    expect(getPublicUiCopy('unknown-locale')).toEqual(getPublicUiCopy('en'));
  });
});