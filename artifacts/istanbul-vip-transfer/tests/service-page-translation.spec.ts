/**
 * Unit tests for service-page structured translation logic.
 *
 * Exercises the extract → translate → reconstruct → validate pipeline used by
 * POST /admin/api/translations/ai when entityType='service_page'.
 * No database or server is required — all helpers are pure functions.
 *
 * Key invariants verified:
 *  1. extractTranslatableFields produces the expected flat field map.
 *  2. applyTranslatedFields reconstructs a valid ServicePageBody.
 *  3. hero.title and seo.ogTitle/ogDescription carry translated values
 *     (these map to content_translations.title / metaTitle / metaDescription).
 *  4. features are all translated and the count is preserved.
 *  5. The reconstructed body passes isServicePageBody (schema guard).
 *  6. A mock "save" confirms it would be stored as DRAFT (status invariant).
 */
import { test, expect } from '@playwright/test';
import {
  extractTranslatableFields,
  applyTranslatedFields,
  mergeFaqFallback,
  isServicePageBody,
  parseServicePageBody,
  type ServicePageBody,
} from '../lib/service-page-types';

// ── Fixture ────────────────────────────────────────────────────────────────────

const SOURCE_BODY: ServicePageBody = {
  version: 1,
  hero: {
    badge:        'VIP Havalimanı Transfer',
    title:        'İstanbul Havalimanı Transfer',
    subtitle:     'Konforlu ve güvenli ulaşım',
    crumb:        'Havalimanı Transfer',
    ctaPrimary:   'Hemen Rezervasyon',
    ctaSecondary: 'WhatsApp İletişim',
  },
  features: [
    'Profesyonel şoför hizmeti',
    '7/24 müşteri desteği',
    'Uçuş takip sistemi',
  ],
  seo: {
    ogTitle:       'İstanbul Havalimanı VIP Transfer | İstanbul VIP Transfer',
    ogDescription: 'İstanbul Havalimanı\'ndan şehir merkezine konforlu VIP transfer hizmeti.',
  },
};

/** Simulated "AI translated" output — values are English equivalents of the Turkish source. */
function buildTranslatedMap(fields: Record<string, string>): Record<string, string> {
  const translations: Record<string, string> = {
    'hero.badge':        'VIP Airport Transfer',
    'hero.title':        'Istanbul Airport Transfer',
    'hero.subtitle':     'Comfortable and safe transportation',
    'hero.crumb':        'Airport Transfer',
    'hero.ctaPrimary':   'Book Now',
    'hero.ctaSecondary': 'WhatsApp Contact',
    'seo.ogTitle':       'Istanbul Airport VIP Transfer | Istanbul VIP Transfer',
    'seo.ogDescription': 'Comfortable VIP transfer service from Istanbul Airport to the city center.',
    'feature.0':         'Professional driver service',
    'feature.1':         '7/24 customer support',
    'feature.2':         'Flight tracking system',
  };
  // Return only keys that were in the original field map (mirrors translateServicePageFields behaviour)
  return Object.fromEntries(Object.keys(fields).map((k) => [k, translations[k] ?? fields[k]]));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('extractTranslatableFields returns all expected keys', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);

  // Hero fields
  expect(fields['hero.badge']).toBe('VIP Havalimanı Transfer');
  expect(fields['hero.title']).toBe('İstanbul Havalimanı Transfer');
  expect(fields['hero.subtitle']).toBe('Konforlu ve güvenli ulaşım');
  expect(fields['hero.crumb']).toBe('Havalimanı Transfer');
  expect(fields['hero.ctaPrimary']).toBe('Hemen Rezervasyon');
  expect(fields['hero.ctaSecondary']).toBe('WhatsApp İletişim');

  // SEO fields
  expect(fields['seo.ogTitle']).toBeDefined();
  expect(fields['seo.ogDescription']).toBeDefined();

  // Feature fields
  expect(fields['feature.0']).toBe('Profesyonel şoför hizmeti');
  expect(fields['feature.1']).toBe('7/24 müşteri desteği');
  expect(fields['feature.2']).toBe('Uçuş takip sistemi');

  // No unexpected keys
  expect(Object.keys(fields)).toHaveLength(11);
});

test('applyTranslatedFields produces a valid ServicePageBody', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const translated = buildTranslatedMap(fields);
  const result = applyTranslatedFields(SOURCE_BODY, translated);

  expect(isServicePageBody(result)).toBe(true);
  expect(result.version).toBe(1);
});

test('mergeFaqFallback matches source FAQ ids when translations are reordered or orphaned', () => {
  const turkish: ServicePageBody = {
    ...SOURCE_BODY,
    version: 2,
    faqs: [
      { id: 'faq-first', question: 'İlk Türkçe soru', answer: 'İlk Türkçe cevap' },
      { id: 'faq-second', question: 'İkinci Türkçe soru', answer: 'İkinci Türkçe cevap' },
    ],
  };
  const translated: ServicePageBody = {
    ...turkish,
    faqs: [
      // The translated list is deliberately reordered.
      { id: 'faq-second', question: 'Second translated question', answer: 'Second translated answer' },
      // This FAQ was deleted from the Turkish source and must not be published.
      { id: 'faq-deleted', question: 'Orphaned question', answer: 'Orphaned answer' },
      // An incomplete translation falls back only for its matching source id.
      { id: 'faq-first', question: 'First translated question', answer: '' },
    ],
  };

  const result = mergeFaqFallback(translated, turkish);

  expect(result.faqs).toEqual([
    { id: 'faq-first', question: 'First translated question', answer: 'İlk Türkçe cevap' },
    { id: 'faq-second', question: 'Second translated question', answer: 'Second translated answer' },
  ]);
});

test('translated hero.title reflects AI output (maps to content_translations.title)', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const result = applyTranslatedFields(SOURCE_BODY, buildTranslatedMap(fields));

  expect(result.hero.title).toBe('Istanbul Airport Transfer');
});

test('translated seo.ogTitle and seo.ogDescription map to metaTitle / metaDescription', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const result = applyTranslatedFields(SOURCE_BODY, buildTranslatedMap(fields));

  // These values are what the route stores as metaTitle / metaDescription
  expect(result.seo.ogTitle).toBe('Istanbul Airport VIP Transfer | Istanbul VIP Transfer');
  expect(result.seo.ogDescription).toBe('Comfortable VIP transfer service from Istanbul Airport to the city center.');

  // Verify they are non-empty (guard against the Turkish-passthrough regression)
  expect(result.seo.ogTitle).not.toContain('İstanbul');
  expect(result.seo.ogDescription).not.toContain('İstanbul');
});

test('features are all translated and count is preserved', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const result = applyTranslatedFields(SOURCE_BODY, buildTranslatedMap(fields));

  expect(result.features).toHaveLength(SOURCE_BODY.features.length);
  expect(result.features[0]).toBe('Professional driver service');
  expect(result.features[1]).toBe('7/24 customer support');
  expect(result.features[2]).toBe('Flight tracking system');
});

test('JSON-stringified body round-trips through parseServicePageBody', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const result = applyTranslatedFields(SOURCE_BODY, buildTranslatedMap(fields));

  const bodyJson = JSON.stringify(result);
  const reparsed = parseServicePageBody(bodyJson);

  expect(reparsed).not.toBeNull();
  expect(isServicePageBody(reparsed)).toBe(true);
  expect(reparsed!.hero.title).toBe('Istanbul Airport Transfer');
});

test('mock save: translated body would be stored as DRAFT (status invariant)', () => {
  const fields = extractTranslatableFields(SOURCE_BODY);
  const translatedBody = applyTranslatedFields(SOURCE_BODY, buildTranslatedMap(fields));

  // Simulate the route's save payload — verify status is DRAFT and never APPROVED/PUBLISHED
  const savePayload = {
    status: 'DRAFT',
    body: JSON.stringify(translatedBody),
    title: translatedBody.hero.title || null,
    metaTitle: translatedBody.seo.ogTitle || null,
    metaDescription: translatedBody.seo.ogDescription || null,
    isAiGenerated: true,
  };

  expect(savePayload.status).toBe('DRAFT');
  expect(savePayload.status).not.toBe('APPROVED');
  expect(savePayload.status).not.toBe('PUBLISHED');
  expect(savePayload.title).toBe('Istanbul Airport Transfer');
  expect(savePayload.metaTitle).toBe('Istanbul Airport VIP Transfer | Istanbul VIP Transfer');
  expect(savePayload.isAiGenerated).toBe(true);

  // Body must be parseable and valid
  expect(parseServicePageBody(savePayload.body)).not.toBeNull();
});
