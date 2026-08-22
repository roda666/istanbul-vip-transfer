import { describe, expect, it } from 'vitest';
import {
  getTranslationEntityTypeForContent,
} from '../../lib/i18n/language-publication';
import { isLocaleCodeSyntax } from '../../lib/i18n/locale-registry';

describe('language lifecycle guards', () => {
  it('accepts route-safe catalog locale codes without freezing the locale list', () => {
    expect(isLocaleCodeSyntax('pt')).toBe(true);
    expect(isLocaleCodeSyntax('he')).toBe(true);
    expect(isLocaleCodeSyntax('zh-Hant')).toBe(true);
    expect(isLocaleCodeSyntax('not a locale')).toBe(false);
    expect(isLocaleCodeSyntax('../tr')).toBe(false);
  });

  it('uses the public renderer entity type for each published CMS source', () => {
    expect(getTranslationEntityTypeForContent({
      id: 'homepage-id', slug: 'ana-sayfa', contentType: 'PAGE',
    })).toBe('homepage');
    expect(getTranslationEntityTypeForContent({
      id: 'service-id', slug: 'istanbul-havalimani-transfer', contentType: 'SERVICE',
    })).toBe('service_page');
    expect(getTranslationEntityTypeForContent({
      id: 'blog-id', slug: 'airport-transfer-guide', contentType: 'BLOG_POST',
    })).toBe('content');
  });
});