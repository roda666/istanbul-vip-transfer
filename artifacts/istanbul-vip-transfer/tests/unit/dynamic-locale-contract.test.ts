import { describe, expect, it } from 'vitest';
import { isLocaleCodeSyntax } from '../../lib/i18n/locale-registry';
import { localePath } from '../../lib/locale-path';

describe('dynamic locale contract', () => {
  it('accepts a future locale without requiring a static tuple update', () => {
    const localeFromCatalog = 'pt';
    expect(isLocaleCodeSyntax(localeFromCatalog)).toBe(true);
  });

  it('retains support for locale tags with a region or script subtag', () => {
    expect(isLocaleCodeSyntax('pt-BR')).toBe(true);
    expect(isLocaleCodeSyntax('zh-Hant')).toBe(true);
  });

  it('keeps a future locale prefix while switching paths', () => {
    expect(localePath('/pt/blog/example', 'he')).toBe('/he/blog/example');
    expect(localePath('/hizmetler', 'pt')).toBe('/pt/hizmetler');
  });
});