/**
 * Pure health-check logic for blog post CMS records.
 *
 * This module has NO database or Next.js dependencies — it is a pure function
 * that compares a list of known slugs (from blog-data.ts) against DB rows and
 * returns a structured list of health issues.
 *
 * Being dependency-free means it can be unit-tested directly with fixture data
 * without spinning up a database or Next.js server.
 *
 * ── Why translations, not source-record flags ──────────────────────────────
 *
 * The Turkish source route (/blog/[slug]) reads from the STATIC blog-data.ts
 * file and therefore CANNOT silently go offline regardless of DB state.
 *
 * The localized routes (/en/blog/…, /de/blog/…, etc.) read from the
 * contentTranslations table and return 404 when a translation row is absent
 * or its status is not 'PUBLISHED'. The source content row's is_active /
 * status columns are NOT consulted by that route.
 *
 * Therefore the health check targets translation completeness, not source flags:
 *   - missing_source_record     → no BLOG_POST row in content table; translations
 *                                  cannot be linked without an entity_id reference
 *   - missing_translation       → one or more non-TR locales have no translation row
 *   - translation_not_published → a translation row exists but status != 'PUBLISHED'
 */
import { SUPPORTED_LANGS } from './i18n';

// ── Public types ─────────────────────────────────────────────────────────────

export type BlogIssueCode =
  | 'missing_source_record'   // no BLOG_POST row in content table
  | 'missing_translation'     // one or more non-TR locales have no translation row
  | 'translation_not_published'; // a translation row exists but status != 'PUBLISHED'

/** Per-locale breakdown included in BlogHealthItem. */
export interface BlogTranslationDetail {
  locale: string;
  problem: 'missing' | 'not_published';
}

export interface BlogHealthItem {
  /** Source content row id — null when the record is entirely absent. */
  id: string | null;
  slug: string;
  /** Source content row title — null when the record is entirely absent. */
  title: string | null;
  /** Summary issue codes (one or more). */
  issues: BlogIssueCode[];
  /** Per-locale breakdown of translation problems. */
  translationDetails: BlogTranslationDetail[];
}

export interface BlogHealthReport {
  checkedAt: string;
  /** Total number of blog slugs declared in blog-data.ts. */
  knownCount: number;
  /** Total number of BLOG_POST rows present in the database. */
  dbCount: number;
  /** Total number of contentTranslations rows for BLOG_POST entities. */
  translationCount: number;
  unhealthyCount: number;
  /** Only the unhealthy items. */
  items: BlogHealthItem[];
}

/** Shape required from each source content DB row. */
export interface BlogSourceRow {
  id: string;
  slug: string;
  title: string;
}

/** Shape required from each contentTranslations DB row. */
export interface BlogTranslationRow {
  entityId: string;
  targetLanguageCode: string;
  status: string;
}

// ── Known blog slugs ──────────────────────────────────────────────────────────

/**
 * Returns an empty list — all blog posts are now DB-driven.
 * The health check cross-references the DB source rows directly (passed as
 * `sourceRows` to `computeBlogHealthIssues`), so a static slug list is no
 * longer needed for detecting missing_source_record issues.
 *
 * Kept as a named export for backward-compatibility with existing callers.
 */
export function getKnownBlogSlugs(): string[] {
  return [];
}

/**
 * The non-Turkish locales whose translated routes the site publicly exposes.
 * Mirrors SUPPORTED_LANGS in lib/i18n/index.ts (en, de, ru, ar, es, fr, it, nl).
 * Automatically expands when new locales are added to the registry.
 */
export function getTranslationLocales(): string[] {
  return [...SUPPORTED_LANGS]; // en, de, ru, ar, es, fr, it, nl
}

// ── Core health check (pure function) ────────────────────────────────────────

/**
 * Cross-references `knownSlugs` against `sourceRows` and `translationRows`,
 * returning one `BlogHealthItem` for every slug that has at least one problem.
 *
 * Problems detected:
 *  - `missing_source_record`    — slug in blog-data.ts but no BLOG_POST DB row
 *  - `missing_translation`      — one or more locales in checkLocales have no
 *                                  contentTranslations row for this entity
 *  - `translation_not_published`— translation row exists but status != 'PUBLISHED'
 *
 * Healthy slugs (source present + all locales have PUBLISHED translations) are
 * omitted from the result, so an empty array means all good.
 *
 * @param knownSlugs    - Slugs from blog-data.ts (source of truth)
 * @param sourceRows    - All BLOG_POST rows from the content table
 * @param translationRows - All contentTranslations rows for BLOG_POST entities
 * @param checkLocales  - Non-TR locales to verify (default: all 8 non-TR registry locales)
 */
export function computeBlogHealthIssues(
  knownSlugs: string[],
  sourceRows: BlogSourceRow[],
  translationRows: BlogTranslationRow[],
  checkLocales: string[] = getTranslationLocales(),
): BlogHealthItem[] {
  const sourceBySlug = new Map<string, BlogSourceRow>(sourceRows.map(r => [r.slug, r]));

  // Build: entityId → locale → status
  const translationMap = new Map<string, Map<string, string>>();
  for (const t of translationRows) {
    if (!translationMap.has(t.entityId)) {
      translationMap.set(t.entityId, new Map());
    }
    translationMap.get(t.entityId)!.set(t.targetLanguageCode, t.status);
  }

  const unhealthy: BlogHealthItem[] = [];

  // 1. Check for known slugs that have no source record in the DB.
  //    With all posts now DB-driven, knownSlugs is typically [] and this
  //    loop is a no-op. Kept for backward compatibility / static-hybrid setups.
  const reportedIds = new Set<string>();

  for (const slug of knownSlugs) {
    const source = sourceBySlug.get(slug);
    if (!source) {
      unhealthy.push({
        id:                 null,
        slug,
        title:              null,
        issues:             ['missing_source_record'],
        translationDetails: [],
      });
    }
  }

  // 2. Check all DB source rows for translation completeness.
  for (const source of sourceRows) {
    if (reportedIds.has(source.id)) continue;
    reportedIds.add(source.id);

    const issues: BlogIssueCode[]          = [];
    const details: BlogTranslationDetail[] = [];
    const localeMap = translationMap.get(source.id) ?? new Map<string, string>();

    for (const locale of checkLocales) {
      const status = localeMap.get(locale);
      if (status === undefined) {
        details.push({ locale, problem: 'missing' });
      } else if (status !== 'PUBLISHED') {
        details.push({ locale, problem: 'not_published' });
      }
    }

    if (details.some(d => d.problem === 'missing'))        issues.push('missing_translation');
    if (details.some(d => d.problem === 'not_published'))  issues.push('translation_not_published');

    if (issues.length > 0) {
      unhealthy.push({ id: source.id, slug: source.slug, title: source.title, issues, translationDetails: details });
    }
  }

  return unhealthy;
}
