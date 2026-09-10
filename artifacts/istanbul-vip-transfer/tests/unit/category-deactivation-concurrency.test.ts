import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const categoryRoute = readFileSync(new URL(
  '../../app/admin/api/categories/[id]/route.ts',
  import.meta.url,
), 'utf8');
const serviceRoute = readFileSync(new URL(
  '../../app/admin/api/service-pages/[id]/route.ts',
  import.meta.url,
), 'utf8');

describe('category deactivation concurrency contract', () => {
  it('checks active services and updates the category inside a transaction lock', () => {
    expect(categoryRoute).toContain('db.transaction(async (tx) =>');
    expect(categoryRoute).toContain('pg_advisory_xact_lock(hashtext(${cat.slug}))');
    expect(categoryRoute).toContain('SELECT COUNT(*)::int AS cnt FROM content');

    const transactionStart = categoryRoute.indexOf('db.transaction(async (tx) =>');
    const countCheck = categoryRoute.indexOf('SELECT COUNT(*)::int AS cnt FROM content');
    const categoryUpdate = categoryRoute.indexOf('tx.update(serviceCategories)');
    expect(transactionStart).toBeGreaterThanOrEqual(0);
    expect(countCheck).toBeGreaterThan(transactionStart);
    expect(categoryUpdate).toBeGreaterThan(countCheck);
  });

  it('uses the same advisory lock while validating and assigning a service category', () => {
    expect(serviceRoute).toContain('db.transaction(async (tx) =>');
    expect(serviceRoute).toContain('pg_advisory_xact_lock(hashtext(${effectiveCategory}))');
    expect(serviceRoute).toContain('tx.update(content)');
  });
});