import { afterEach, describe, expect, it } from 'vitest';
import { HOMEPAGE_FALLBACK } from '../../lib/homepage-types';
import {
  HOMEPAGE_AUTOMATIC_TARGET_LOCALES,
  applyTranslatedFields,
  computeTranslatableHash,
  isHomepageSyncCurrent,
  resolveHomepageSyncTargets,
  syncSharedFields,
} from '../../lib/homepage-sync';
import {
  classifyHomepageTranslationError,
  parseHomepageTranslationResponse,
} from '../../lib/ai/homepage-translation-response';
import {
  DEFAULT_OPENAI_MODEL,
  getOpenAiContentModel,
  getOpenAiTranslationModel,
} from '../../lib/ai/model-config-core';

const originalModel = process.env.OPENAI_MODEL;
const originalContentModel = process.env.OPENAI_CONTENT_MODEL;
const originalTranslationModel = process.env.OPENAI_TRANSLATION_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
  if (originalContentModel === undefined) delete process.env.OPENAI_CONTENT_MODEL;
  else process.env.OPENAI_CONTENT_MODEL = originalContentModel;
  if (originalTranslationModel === undefined) delete process.env.OPENAI_TRANSLATION_MODEL;
  else process.env.OPENAI_TRANSLATION_MODEL = originalTranslationModel;
});

describe('homepage source synchronization', () => {
  it('requires all eight non-Turkish public homepage locales', () => {
    expect(HOMEPAGE_AUTOMATIC_TARGET_LOCALES).toEqual([
      'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl',
    ]);
    expect(resolveHomepageSyncTargets(['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'])).toEqual({
      targets: ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'],
      unavailable: [],
    });
    expect(resolveHomepageSyncTargets(['tr', 'en', 'de'])).toEqual({
      targets: ['en', 'de'],
      unavailable: ['ru', 'ar', 'fr', 'es', 'it', 'nl'],
    });
  });

  it('copies source-owned flags, routes, images and structure without replacing translated copy', () => {
    const source = structuredClone(HOMEPAGE_FALLBACK.tr);
    const target = structuredClone(HOMEPAGE_FALLBACK.en);

    source.hero.enabled = false;
    source.hero.imagePath = '/hero/new-transfer.webp';
    source.hero.imageAlt = 'Yeni Türkçe alt metin';
    source.servicesSection.enabled = false;
    source.servicesSection.allServicesRoute = '/hizmetler/yeni';
    source.vehiclesSection.ctaRoute = '/rezervasyon/yeni';
    source.seo.ogImage = '/hero/social-new.webp';
    source.seo.indexable = false;
    source.heroStats = source.heroStats.filter((stat) => stat.key !== 'support');
    source.trustSection.cards = source.trustSection.cards.slice(0, 2);

    const result = syncSharedFields(target, source);

    expect(result.hero).toMatchObject({
      enabled: false,
      imagePath: '/hero/new-transfer.webp',
      imageAlt: target.hero.imageAlt,
    });
    expect(result.servicesSection).toMatchObject({
      enabled: false,
      allServicesRoute: '/hizmetler/yeni',
      heading: target.servicesSection.heading,
    });
    expect(result.vehiclesSection.ctaRoute).toBe('/rezervasyon/yeni');
    expect(result.seo).toMatchObject({
      ogImage: '/hero/social-new.webp',
      indexable: false,
      ogTitle: target.seo.ogTitle,
    });
    expect(result.heroStats.map((stat) => stat.key)).toEqual(['airport', 'vehicles']);
    expect(result.trustSection.cards.map((card) => card.id)).toEqual(source.trustSection.cards.map((card) => card.id));

    const translated = applyTranslatedFields(result, {
      'hero.imageAlt': 'New English alt text',
      'seo.ogTitle': 'New social title',
    });
    expect(translated.hero.imageAlt).toBe('New English alt text');
    expect(translated.seo.ogTitle).toBe('New social title');
  });

  it('skips repeated saves for an unchanged successful or in-flight source hash', () => {
    expect(isHomepageSyncCurrent({ sourceHash: 'same', status: 'PUBLISHED' }, 'same')).toBe(true);
    expect(isHomepageSyncCurrent({ sourceHash: 'same', status: 'TRANSLATING' }, 'same')).toBe(true);
    expect(isHomepageSyncCurrent({ sourceHash: 'same', status: 'FAILED' }, 'same')).toBe(false);
    expect(isHomepageSyncCurrent({ sourceHash: 'older', status: 'PUBLISHED' }, 'same')).toBe(false);
  });

  it('refreshes shared fields even when a source revision has the same AI text hash', () => {
    const initialSource = structuredClone(HOMEPAGE_FALLBACK.tr);
    const newerSource = structuredClone(initialSource);
    const target = structuredClone(HOMEPAGE_FALLBACK.en);

    newerSource.hero.imagePath = '/hero/new-shared-image.webp';
    newerSource.hero.enabled = false;
    newerSource.servicesSection.allServicesRoute = '/hizmetler/guncel';

    // Shared fields intentionally do not cause a second provider request.
    expect(computeTranslatableHash(newerSource)).toBe(computeTranslatableHash(initialSource));

    const refreshedSharedPayload = syncSharedFields(target, newerSource);
    expect(refreshedSharedPayload.hero).toMatchObject({
      imagePath: '/hero/new-shared-image.webp',
      enabled: false,
    });
    expect(refreshedSharedPayload.servicesSection.allServicesRoute).toBe('/hizmetler/guncel');
  });
});

describe('homepage AI response safety', () => {
  const fields = { 'hero.headline1': 'İstanbul' };

  it('rejects blank and malformed AI responses instead of falling back to Turkish source text', () => {
    expect(parseHomepageTranslationResponse(fields, '')).toMatchObject({
      ok: false,
      reason: 'api_error',
    });
    expect(parseHomepageTranslationResponse(fields, '{not-json}')).toMatchObject({
      ok: false,
      reason: 'parse_error',
    });
    expect(parseHomepageTranslationResponse(fields, '{}')).toMatchObject({
      ok: false,
      reason: 'parse_error',
    });
  });

  it('classifies provider failures without exposing provider response details', () => {
    expect(classifyHomepageTranslationError(new Error('429 upstream quota exceeded'))).toEqual({
      ok: false,
      reason: 'rate_limited',
      message: 'OpenAI rate limit reached',
    });
    expect(classifyHomepageTranslationError(new Error('internal upstream token=private'))).toEqual({
      ok: false,
      reason: 'api_error',
      message: 'OpenAI translation request failed',
    });
  });

  it('prefers OPENAI_MODEL while preserving legacy content and translation settings', () => {
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_CONTENT_MODEL;
    delete process.env.OPENAI_TRANSLATION_MODEL;
    expect(getOpenAiContentModel()).toBe(DEFAULT_OPENAI_MODEL);
    expect(getOpenAiTranslationModel()).toBe(DEFAULT_OPENAI_MODEL);

    process.env.OPENAI_CONTENT_MODEL = 'legacy-content-model';
    process.env.OPENAI_TRANSLATION_MODEL = 'legacy-translation-model';
    expect(getOpenAiContentModel()).toBe('legacy-content-model');
    expect(getOpenAiTranslationModel()).toBe('legacy-translation-model');

    process.env.OPENAI_MODEL = 'custom-model';
    expect(getOpenAiContentModel()).toBe('custom-model');
    expect(getOpenAiTranslationModel()).toBe('custom-model');
  });
});