/**
 * Unit tests for service page health-check logic.
 *
 * These tests exercise `computeServiceHealthIssues` with fixture data —
 * no database or server required. Each test simulates a specific failure
 * mode (missing record, inactive, unpublished, invalid body schema) and
 * asserts the correct IssueCode is returned.
 *
 * This suite is the regression safety net: if the health logic ever stops
 * detecting a known failure mode, these tests break immediately.
 */
import { test, expect } from '@playwright/test';
import {
  computeServiceHealthIssues,
  getRegisteredServiceSlugs,
  type ServiceDbRow,
} from '../lib/service-page-health';

// ── Fixture helpers ────────────────────────────────────────────────────────────

/** A valid ServicePageBody JSON string that passes the schema guard. */
const VALID_BODY = JSON.stringify({
  version: 1,
  hero: {
    badge: 'VIP',
    title: 'Test Hizmet',
    subtitle: 'Alt başlık',
    crumb: 'Test',
    ctaPrimary: 'Rezervasyon',
    ctaSecondary: 'WhatsApp',
  },
  features: ['Feature A', 'Feature B'],
  seo: { ogTitle: 'OG Title', ogDescription: 'OG Desc' },
});

/** Returns a healthy DB row for the given slug. */
function healthyRow(slug: string, overrides: Partial<ServiceDbRow> = {}): ServiceDbRow {
  return {
    id:       `id-${slug}`,
    slug,
    title:    `Title for ${slug}`,
    status:   'PUBLISHED',
    isActive: true,
    body:     VALID_BODY,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('computeServiceHealthIssues — fixture-based unit tests', () => {

  test('returns empty array when all registered slugs are healthy', () => {
    const slugs = ['slug-a', 'slug-b'];
    const rows  = slugs.map(s => healthyRow(s));
    const result = computeServiceHealthIssues(slugs, rows);
    expect(result).toHaveLength(0);
  });

  test('flags missing_record when a registered slug has no DB row at all', () => {
    const result = computeServiceHealthIssues(
      ['exists', 'missing'],
      [healthyRow('exists')],
    );
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('missing');
    expect(result[0].issues).toContain('missing_record');
    expect(result[0].id).toBeNull();
    expect(result[0].title).toBeNull();
  });

  test('flags inactive when is_active = false', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { isActive: false })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('inactive');
    expect(result[0].issues).not.toContain('missing_record');
  });

  test('flags not_published when status is DRAFT', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { status: 'DRAFT' })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('not_published');
  });

  test('flags not_published when status is ARCHIVED', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { status: 'ARCHIVED' })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('not_published');
  });

  test('flags body_missing when body column is null', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { body: null })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('body_missing');
    expect(result[0].hasValidBody).toBe(false);
  });

  test('flags body_missing when body column is empty string', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { body: '' })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('body_missing');
  });

  test('flags body_invalid_schema when body is valid JSON but fails ServicePageBody guard (bare {})', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { body: '{}' })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('body_invalid_schema');
    expect(result[0].hasValidBody).toBe(false);
  });

  test('flags body_invalid_schema when body has wrong version number', () => {
    const badBody = JSON.stringify({ version: 2, hero: {}, features: [], seo: {} });
    const result  = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { body: badBody })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].issues).toContain('body_invalid_schema');
  });

  test('reports multiple issues on a single record (inactive + not_published + body_missing)', () => {
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { isActive: false, status: 'DRAFT', body: null })],
    );
    expect(result).toHaveLength(1);
    const issues = result[0].issues;
    expect(issues).toContain('inactive');
    expect(issues).toContain('not_published');
    expect(issues).toContain('body_missing');
  });

  test('reports issues for multiple unhealthy slugs in one call', () => {
    const result = computeServiceHealthIssues(
      ['ok', 'inactive-slug', 'missing-slug'],
      [
        healthyRow('ok'),
        healthyRow('inactive-slug', { isActive: false }),
        // 'missing-slug' intentionally absent from DB rows
      ],
    );
    expect(result).toHaveLength(2);
    const slugs = result.map(r => r.slug);
    expect(slugs).toContain('inactive-slug');
    expect(slugs).toContain('missing-slug');
  });

  test('hasValidBody is true only for a schema-conforming body', () => {
    // A fully healthy row is omitted from results — confirm it produces no issues
    const noIssues = computeServiceHealthIssues(['slug-a'], [healthyRow('slug-a')]);
    expect(noIssues).toHaveLength(0);

    // For an inactive row with a valid body, hasValidBody should still be true
    // and body-related issues should not appear alongside the 'inactive' flag
    const result = computeServiceHealthIssues(
      ['slug-a'],
      [healthyRow('slug-a', { isActive: false })],
    );
    expect(result[0].hasValidBody).toBe(true);
    expect(result[0].issues).not.toContain('body_missing');
    expect(result[0].issues).not.toContain('body_invalid_schema');
  });

});

// ── Integration: registered slugs from PAGE_REGISTRY ─────────────────────────

test.describe('getRegisteredServiceSlugs — PAGE_REGISTRY integration', () => {

  test('returns exactly 14 service slugs matching the known registry', () => {
    const slugs = getRegisteredServiceSlugs();
    expect(slugs).toHaveLength(14);
  });

  test('includes all expected service page slugs', () => {
    const slugs = getRegisteredServiceSlugs();
    const expected = [
      'istanbul-havalimani-transfer',
      'sabiha-gokcen-havalimani-transfer',
      'vip-transfer',
      'sehirler-arasi-transfer',
      'soforlu-arac-kiralama',
      'otel-transfer',
      'saglik-turizmi-transfer',
      'kurumsal-vip-transfer',
      'istanbul-bursa-transfer',
      'istanbul-sapanca-transfer',
      'istanbul-gunubirlik-turlar',
      'sapanca-masukiye-turu',
      'bursa-gunubirlik-tur',
      'yalova-gunubirlik-tur',
    ];
    for (const s of expected) {
      expect(slugs, `Expected '${s}' in registered slugs`).toContain(s);
    }
  });

  test('does not include non-service page slugs (hizmetler, araclar, etc.)', () => {
    const slugs = getRegisteredServiceSlugs();
    const nonService = ['hizmetler', 'araclar', 'hakkimizda', 'iletisim'];
    for (const s of nonService) {
      expect(slugs, `Non-service slug '${s}' should not be in list`).not.toContain(s);
    }
  });

});
