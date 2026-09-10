import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildHealthHistoryViewModel } from '@/lib/health-history';
import { shouldSendServiceHealthAlert, shouldRecordServiceHealthAlert } from '@/lib/service-health-scheduler';
import { isMissingBlogHealthTableError, escapeBlogHealthHtml, ownsHealthCheckLease } from '@/lib/blog-health-scheduler';
import { computeBlogHealthIssues } from '@/lib/blog-health';

describe('health monitoring regressions', () => {
  it('keeps a bounded history model and exposes recurring outage slugs', () => {
    const runs = Array.from({ length: 14 }, (_, i) => ({
      checkedAt: new Date(1_700_000_000_000 + i),
      unhealthyCount: i % 2,
      result: i === 0 ? [{ slug: 'airport-transfer' }] : [],
    }));
    const model = buildHealthHistoryViewModel(runs);
    expect(model).toHaveLength(12);
    expect(model[0].slugs).toEqual(['airport-transfer']);
    expect(buildHealthHistoryViewModel([{
      checkedAt: new Date(), unhealthyCount: 2,
      result: [{ slug: 'recurring-outage' }, { slug: '' }, { nope: true }],
    }])[0].slugs).toEqual(['recurring-outage']);
  });

  it('does not treat failed/skipped delivery as a cooldown advance', () => {
    const now = Date.now();
    expect(shouldSendServiceHealthAlert(null, now)).toBe(true);
    expect(shouldSendServiceHealthAlert(new Date(now), now)).toBe(false);
    expect(shouldSendServiceHealthAlert(new Date(now - 6 * 60 * 60 * 1_000), now)).toBe(true);
    expect(shouldRecordServiceHealthAlert(false)).toBe(false);
    expect(shouldRecordServiceHealthAlert(true)).toBe(true);
  });

  it('detects missing blog health tables without throwing', () => {
    expect(isMissingBlogHealthTableError({ code: '42P01' })).toBe(true);
    expect(isMissingBlogHealthTableError(new Error('relation "blog_health_runs" does not exist'))).toBe(true);
    expect(isMissingBlogHealthTableError(new Error('connection refused'))).toBe(false);
  });

  it('escapes database-derived blog alert values before HTML rendering', () => {
    expect(escapeBlogHealthHtml(`<img src=x onerror="bad"> & 'x'`))
      .toBe('&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; &#39;x&#39;');
  });

  it('only releases a lease when the owner token matches', () => {
    expect(ownsHealthCheckLease('owner-a', 'owner-a')).toBe(true);
    expect(ownsHealthCheckLease('owner-a', 'owner-b')).toBe(false);
    expect(ownsHealthCheckLease(undefined, 'owner-b')).toBe(false);
  });

  it('flags both missing and unpublished translated locales', () => {
    const issues = computeBlogHealthIssues(
      [],
      [{ id: 'post-1', slug: 'istanbul-guide', title: 'Guide' }],
      [{ entityId: 'post-1', targetLanguageCode: 'en', status: 'DRAFT' }],
      ['en', 'de'],
    );
    expect(issues[0].issues).toEqual(['missing_translation', 'translation_not_published']);
    expect(issues[0].translationDetails).toEqual([
      { locale: 'en', problem: 'not_published' },
      { locale: 'de', problem: 'missing' },
    ]);
  });

  it('keeps the canonical health migration after the current journal entry', () => {
    const root = path.resolve(__dirname, '../..');
    const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/migrations/meta/_journal.json'), 'utf8'));
    const latest = journal.entries.at(-1);
    expect(latest.tag).toBe('0080_health_check_leases');
    expect(journal.entries.at(-2).tag).toBe('0079_blog_health_monitoring');
    const leaseMigration = fs.readFileSync(path.join(root, 'drizzle/migrations/0080_health_check_leases.sql'), 'utf8');
    expect(leaseMigration).toContain('"lock_name" text PRIMARY KEY');
    expect(leaseMigration).toContain('"owner_token" text NOT NULL');
    expect(leaseMigration).toContain('"expires_at" timestamp with time zone NOT NULL');
    expect(fs.existsSync(path.join(root, 'drizzle/migrations/0009_service_health_monitoring.sql'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'drizzle/migrations/0079_blog_health_monitoring.sql'))).toBe(true);
    const migration = fs.readFileSync(path.join(root, 'drizzle/migrations/0079_blog_health_monitoring.sql'), 'utf8');
    expect(migration).toContain('blog_health_runs_checked_at_idx');
    expect(migration).not.toContain('service_health_runs_checked_at_idx');
    const startup = fs.readFileSync(path.join(root, 'instrumentation.node.ts'), 'utf8');
    expect(startup).toContain('startBlogHealthScheduler()');
  });
});