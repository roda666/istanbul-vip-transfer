/**
 * Unit tests for blog post health-check logic.
 *
 * These tests exercise `computeBlogHealthIssues` with fixture data —
 * no database or server required. Each test simulates a specific failure
 * mode and asserts the correct BlogIssueCode is returned.
 *
 * The health check targets TRANSLATIONS, not source-record flags, because:
 *  - The Turkish source route (/blog/[slug]) reads from static blog-data.ts
 *    and cannot go offline regardless of DB state.
 *  - Localized routes (/en/blog/…, /de/blog/…, etc.) read from the
 *    contentTranslations table; a missing or unpublished translation silently
 *    returns 404 for non-Turkish visitors.
 *  - The source content row's is_active / status columns are NOT checked by
 *    the localized route, so checking them would be a false positive.
 */
import { test, expect } from '@playwright/test';
import {
  computeBlogHealthIssues,
  getKnownBlogSlugs,
  getTranslationLocales,
  type BlogSourceRow,
  type BlogTranslationRow,
} from '../lib/blog-health';

// ── Fixture helpers ────────────────────────────────────────────────────────────

const CHECK_LOCALES = ['en', 'de', 'ru', 'ar'];

function sourceRow(slug: string, overrides: Partial<BlogSourceRow> = {}): BlogSourceRow {
  return { id: `id-${slug}`, slug, title: `Title for ${slug}`, ...overrides };
}

function translationRow(
  entityId: string,
  locale: string,
  status = 'PUBLISHED',
): BlogTranslationRow {
  return { entityId, targetLanguageCode: locale, status };
}

/** Returns translation rows for all CHECK_LOCALES for a given entity. */
function allTranslations(entityId: string, status = 'PUBLISHED'): BlogTranslationRow[] {
  return CHECK_LOCALES.map(l => translationRow(entityId, l, status));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('computeBlogHealthIssues — fixture-based unit tests', () => {

  test('returns empty array when all known slugs have source records and PUBLISHED translations', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues(['slug-a'], [src], allTranslations(src.id), CHECK_LOCALES);
    expect(result).toHaveLength(0);
  });

  test('flags missing_source_record when a known slug has no BLOG_POST row in DB', () => {
    const result = computeBlogHealthIssues(['missing'], [], [], CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('missing');
    expect(result[0].issues).toContain('missing_source_record');
    expect(result[0].id).toBeNull();
    expect(result[0].title).toBeNull();
    expect(result[0].translationDetails).toHaveLength(0);
  });

  test('flags missing_translation when one locale has no translation row', () => {
    const src          = sourceRow('slug-a');
    const translations = CHECK_LOCALES
      .filter(l => l !== 'de')  // 'de' is missing
      .map(l => translationRow(src.id, l));

    const result = computeBlogHealthIssues(['slug-a'], [src], translations, CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('missing_translation');
    expect(result[0].translationDetails).toContainEqual({ locale: 'de', problem: 'missing' });
    // other locales should NOT appear
    expect(result[0].translationDetails.map(d => d.locale)).not.toContain('en');
  });

  test('flags missing_translation when ALL locale translations are absent', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues(['slug-a'], [src], [], CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('missing_translation');
    expect(result[0].translationDetails).toHaveLength(4); // one per locale
    for (const detail of result[0].translationDetails) {
      expect(detail.problem).toBe('missing');
    }
  });

  test('flags translation_not_published when a translation exists but is DRAFT', () => {
    const src = sourceRow('slug-a');
    const translations = [
      ...CHECK_LOCALES.filter(l => l !== 'ru').map(l => translationRow(src.id, l)),
      translationRow(src.id, 'ru', 'DRAFT'), // 'ru' not published
    ];

    const result = computeBlogHealthIssues(['slug-a'], [src], translations, CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('translation_not_published');
    expect(result[0].issues).not.toContain('missing_translation');
    expect(result[0].translationDetails).toContainEqual({ locale: 'ru', problem: 'not_published' });
  });

  test('flags both missing_translation and translation_not_published when both problems exist', () => {
    const src = sourceRow('slug-a');
    const translations = [
      // 'en' published (healthy)
      translationRow(src.id, 'en', 'PUBLISHED'),
      // 'de' not published (translation_not_published)
      translationRow(src.id, 'de', 'DRAFT'),
      // 'ru' and 'ar' missing (missing_translation)
    ];

    const result = computeBlogHealthIssues(['slug-a'], [src], translations, CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('missing_translation');
    expect(result[0].issues).toContain('translation_not_published');
    const details = result[0].translationDetails;
    expect(details).toContainEqual({ locale: 'de', problem: 'not_published' });
    expect(details).toContainEqual({ locale: 'ru', problem: 'missing' });
    expect(details).toContainEqual({ locale: 'ar', problem: 'missing' });
    // 'en' is healthy — must not appear
    expect(details.map(d => d.locale)).not.toContain('en');
  });

  test('reports issues for multiple unhealthy slugs in one call', () => {
    const srcA = sourceRow('ok');
    const srcB = sourceRow('no-translations');
    const result = computeBlogHealthIssues(
      ['ok', 'no-translations', 'missing-source'],
      [srcA, srcB],
      allTranslations(srcA.id), // only 'ok' has translations
      CHECK_LOCALES,
    );
    expect(result).toHaveLength(2);
    const slugs = result.map(r => r.slug);
    expect(slugs).toContain('no-translations');
    expect(slugs).toContain('missing-source');
  });

  test('extra source rows not in knownSlugs are ignored', () => {
    const known = sourceRow('known');
    const extra = sourceRow('extra-not-in-blog-data');
    const result = computeBlogHealthIssues(
      ['known'],
      [known, extra],
      allTranslations(known.id),
      CHECK_LOCALES,
    );
    expect(result).toHaveLength(0);
  });

  test('missing_source_record item has null id and title with empty translationDetails', () => {
    const result = computeBlogHealthIssues(['ghost'], [], [], CHECK_LOCALES);
    expect(result[0].id).toBeNull();
    expect(result[0].title).toBeNull();
    expect(result[0].translationDetails).toEqual([]);
  });

  test('a fully healthy slug (all locales PUBLISHED) produces no item', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues(['slug-a'], [src], allTranslations(src.id), CHECK_LOCALES);
    expect(result).toHaveLength(0);
  });

});

// ── Integration: known slugs and locales from static sources ──────────────────

test.describe('getKnownBlogSlugs — blog-data.ts integration', () => {

  test('returns at least one blog slug', () => {
    expect(getKnownBlogSlugs().length).toBeGreaterThan(0);
  });

  test('includes all expected blog slugs', () => {
    const slugs    = getKnownBlogSlugs();
    const expected = [
      'istanbul-havalimani-transfer-rehberi',
      'sabiha-gokcen-transfer-rehberi',
      'vip-transfer-ile-taksi-arasindaki-farklar',
    ];
    for (const s of expected) {
      expect(slugs, `Expected '${s}' in known blog slugs`).toContain(s);
    }
  });

  test('returns exactly 3 blog slugs matching the current blog-data.ts', () => {
    expect(getKnownBlogSlugs()).toHaveLength(3);
  });

});

test.describe('getTranslationLocales — i18n integration', () => {

  test('returns the 4 non-TR supported locales', () => {
    const locales = getTranslationLocales();
    expect(locales).toHaveLength(4);
    for (const l of ['en', 'de', 'ru', 'ar']) {
      expect(locales).toContain(l);
    }
  });

  test('does not include Turkish (tr) since TR pages use static data', () => {
    expect(getTranslationLocales()).not.toContain('tr');
  });

});
