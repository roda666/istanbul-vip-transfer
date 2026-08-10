/**
 * Pure health-check logic for service page CMS records.
 *
 * This module has NO database or Next.js dependencies — it is a pure function
 * that compares a list of registered slugs against DB row data and returns a
 * structured list of health issues.
 *
 * Being dependency-free means it can be unit-tested directly with fixture data
 * without spinning up a database or Next.js server.
 */
import { PAGE_REGISTRY } from './page-registry';
import { parseServicePageBody } from './service-page-types';

// ── Public types ─────────────────────────────────────────────────────────────

export type IssueCode =
  | 'missing_record'      // slug registered in PAGE_REGISTRY but absent from DB
  | 'inactive'            // is_active = false
  | 'not_published'       // status != 'PUBLISHED'
  | 'body_missing'        // body column is null / empty
  | 'body_invalid_schema'; // body is JSON but fails ServicePageBody type guard

export interface ServiceHealthItem {
  /** DB row id — null when the record is entirely absent from the database. */
  id: string | null;
  slug: string;
  /** DB row title — null when the record is entirely absent from the database. */
  title: string | null;
  status: string | null;
  isActive: boolean | null;
  /** true only when body exists AND passes the ServicePageBody schema check. */
  hasValidBody: boolean;
  issues: IssueCode[];
}

export interface ServiceHealthReport {
  checkedAt: string;
  /** Total number of SERVICE slugs declared in PAGE_REGISTRY. */
  registeredCount: number;
  /** Total number of SERVICE rows actually present in the database. */
  dbCount: number;
  unhealthyCount: number;
  /** Only the unhealthy items. */
  items: ServiceHealthItem[];
}

/** Shape that the health check requires from each DB row. */
export interface ServiceDbRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  isActive: boolean;
  body: string | null;
}

// ── Registered SERVICE slugs from PAGE_REGISTRY ───────────────────────────────

/**
 * Returns all slugs in PAGE_REGISTRY that have schemaType='Service'.
 * This is the source of truth — every slug here MUST have a healthy DB record.
 */
export function getRegisteredServiceSlugs(): string[] {
  return Object.entries(PAGE_REGISTRY)
    .filter(([, entry]) => entry.schemaType === 'Service')
    .map(([slug]) => slug);
}

// ── Core health check (pure function) ────────────────────────────────────────

/**
 * Cross-references `registeredSlugs` against `dbRows` and returns one
 * `ServiceHealthItem` for every slug that has at least one problem.
 *
 * Problems detected:
 *  - `missing_record`       — slug exists in registry but has no DB row at all
 *  - `inactive`             — DB row has is_active = false
 *  - `not_published`        — DB row status != 'PUBLISHED'
 *  - `body_missing`         — DB row body column is null / empty string
 *  - `body_invalid_schema`  — DB row body is JSON but fails ServicePageBody type guard
 *
 * Healthy slugs are omitted from the result, so an empty array means all good.
 */
export function computeServiceHealthIssues(
  registeredSlugs: string[],
  dbRows: ServiceDbRow[],
): ServiceHealthItem[] {
  const bySlug = new Map<string, ServiceDbRow>(dbRows.map(r => [r.slug, r]));
  const unhealthy: ServiceHealthItem[] = [];

  for (const slug of registeredSlugs) {
    const row = bySlug.get(slug);

    if (!row) {
      unhealthy.push({
        id:           null,
        slug,
        title:        null,
        status:       null,
        isActive:     null,
        hasValidBody: false,
        issues:       ['missing_record'],
      });
      continue;
    }

    const problems: IssueCode[] = [];

    if (!row.isActive) problems.push('inactive');
    if (row.status !== 'PUBLISHED') problems.push('not_published');

    let hasValidBody = false;
    if (!row.body) {
      problems.push('body_missing');
    } else {
      const parsed = parseServicePageBody(row.body);
      if (parsed === null) {
        problems.push('body_invalid_schema');
      } else {
        hasValidBody = true;
      }
    }

    if (problems.length > 0) {
      unhealthy.push({
        id:           row.id,
        slug,
        title:        row.title,
        status:       row.status,
        isActive:     row.isActive,
        hasValidBody,
        issues:       problems,
      });
    }
  }

  return unhealthy;
}
