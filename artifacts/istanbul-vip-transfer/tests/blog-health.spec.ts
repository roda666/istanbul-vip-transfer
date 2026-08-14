/**
 * Unit tests for blog post health-check logic.
 *
 * These tests exercise `computeBlogHealthIssues` with fixture data —
 * no database or server required. Each test simulates a specific failure
 * mode and asserts the correct BlogIssueCode is returned.
 *
 * NOTE (blog CMS upgrade): blog posts are now fully DB-driven.
 * - `getKnownBlogSlugs()` returns [] — all slugs live in the DB, not static data.
 * - `getTranslationLocales()` returns 8 locales (en, de, ru, ar, es, fr, it, nl).
 * - All DB source rows are checked for translation completeness, regardless of
 *   whether they appear in the (now empty) knownSlugs list.
 * - Source rows that have full PUBLISHED translations for all 8 locales are healthy.
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

/** All 8 non-TR locales the app currently exposes. */
const ALL_LOCALES = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];

/** Legacy 4-locale subset used in tests that only check a subset. */
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

/** Returns translation rows for all provided locales for a given entity. */
function allTranslations(entityId: string, locales = CHECK_LOCALES, status = 'PUBLISHED'): BlogTranslationRow[] {
  return locales.map(l => translationRow(entityId, l, status));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('computeBlogHealthIssues — fixture-based unit tests', () => {

  test('returns empty array when a source row has PUBLISHED translations for all checked locales', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues([], [src], allTranslations(src.id), CHECK_LOCALES);
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

    const result = computeBlogHealthIssues([], [src], translations, CHECK_LOCALES);
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('missing_translation');
    expect(result[0].translationDetails).toContainEqual({ locale: 'de', problem: 'missing' });
    // other locales should NOT appear
    expect(result[0].translationDetails.map(d => d.locale)).not.toContain('en');
  });

  test('flags missing_translation when ALL locale translations are absent', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues([], [src], [], CHECK_LOCALES);
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

    const result = computeBlogHealthIssues([], [src], translations, CHECK_LOCALES);
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

    const result = computeBlogHealthIssues([], [src], translations, CHECK_LOCALES);
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

  test('reports issues for multiple unhealthy source rows in one call', () => {
    const srcA = sourceRow('ok');
    const srcB = sourceRow('no-translations');
    const result = computeBlogHealthIssues(
      ['missing-source'],         // one static-known slug with no DB row
      [srcA, srcB],
      allTranslations(srcA.id),   // only 'ok' has translations
      CHECK_LOCALES,
    );
    // 'missing-source' → missing_source_record
    // 'no-translations' → missing_translation (all 4 locales)
    expect(result).toHaveLength(2);
    const slugs = result.map(r => r.slug);
    expect(slugs).toContain('no-translations');
    expect(slugs).toContain('missing-source');
  });

  test('all DB source rows are now checked even when not listed in knownSlugs', () => {
    // Post-CMS-upgrade: DB source rows are the authoritative set.
    // An "extra" source row with missing translations WILL be flagged.
    const extra = sourceRow('new-db-post');
    const result = computeBlogHealthIssues(
      [],          // no static known slugs
      [extra],     // a DB source row with no translations
      [],
      CHECK_LOCALES,
    );
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('new-db-post');
    expect(result[0].issues).toContain('missing_translation');
  });

  test('a source row with full PUBLISHED translations for all 4 checked locales is healthy', () => {
    const src    = sourceRow('slug-a');
    const result = computeBlogHealthIssues([], [src], allTranslations(src.id), CHECK_LOCALES);
    expect(result).toHaveLength(0);
  });

  test('missing_source_record item has null id and title with empty translationDetails', () => {
    const result = computeBlogHealthIssues(['ghost'], [], [], CHECK_LOCALES);
    expect(result[0].id).toBeNull();
    expect(result[0].title).toBeNull();
    expect(result[0].translationDetails).toEqual([]);
  });

});

// ── getKnownBlogSlugs — DB-driven (returns empty list) ────────────────────────

test.describe('getKnownBlogSlugs — DB-driven (returns empty list)', () => {

  test('returns an empty array because all blog posts are now DB-driven', () => {
    // Blog posts are seeded into the DB via db/seed-blog-posts.ts during `db:migrate`.
    // There are no static slugs left in blog-data.ts that need health tracking.
    expect(getKnownBlogSlugs()).toHaveLength(0);
    expect(Array.isArray(getKnownBlogSlugs())).toBe(true);
  });

});

// ── getTranslationLocales — 8 non-TR supported locales ───────────────────────

test.describe('getTranslationLocales — i18n integration', () => {

  test('returns the 8 non-TR supported locales', () => {
    const locales = getTranslationLocales();
    expect(locales).toHaveLength(8);
    for (const l of ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl']) {
      expect(locales).toContain(l);
    }
  });

  test('does not include Turkish (tr) since TR source pages are served directly', () => {
    expect(getTranslationLocales()).not.toContain('tr');
  });

  test('all 8 locales can be used to construct check_locales for computeBlogHealthIssues', () => {
    const src    = sourceRow('slug-a');
    const txRows = allTranslations(src.id, ALL_LOCALES);
    const result = computeBlogHealthIssues([], [src], txRows, ALL_LOCALES);
    expect(result).toHaveLength(0);  // all 8 locales present and PUBLISHED → healthy
  });

});
