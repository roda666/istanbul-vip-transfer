import { describe, expect, it } from 'vitest';
import { getFaqs } from '../../lib/faq-data';
import { getDictionary } from '../../lib/i18n';

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
const TURKISH_FAQ_MARKERS = [
  'Transfer ücretleriniz nasıl belirleniyor?',
  'Kaç bagaj taşıyabilirim?',
  'Uçuşum gecikirse sürücü bekler mi?',
  'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
  'Ne kadar önceden rezervasyon yapmalıyım?',
  'Çocuk koltuğu talep edebilir miyim?',
];

describe('public locale content guards', () => {
  it.each(TARGET_LOCALES)('serves a complete non-Turkish homepage FAQ for %s', (locale) => {
    const faqs = getFaqs(locale);

    expect(faqs).toHaveLength(6);
    expect(faqs.every((faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0)).toBe(true);
    expect(faqs.map((faq) => faq.question)).not.toEqual(TURKISH_FAQ_MARKERS);
  });

  it('does not return the Turkish FAQ or dictionary for an unknown locale', () => {
    expect(getFaqs('unknown-locale')).toEqual(getFaqs('en'));
    expect(getDictionary('unknown-locale')).toEqual(getDictionary('en'));
  });
});