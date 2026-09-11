import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const preview = readFileSync(new URL('../../app/admin/api/pricing/tolls/import/preview/route.ts', import.meta.url), 'utf8');
const confirm = readFileSync(new URL('../../app/admin/api/pricing/tolls/import/confirm/route.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../drizzle/migrations/0094_toll_tariff_import_reconciliation.sql', import.meta.url), 'utf8');

describe('import API safety contracts', () => {
  it('scopes preview lookup and confirmation ownership to point/admin', () => {
    expect(preview).toContain('tollTariffImports.createdBy');
    expect(preview).toContain('tollTariffImports.tollPointId');
    expect(confirm).toContain('tollTariffImports.createdBy');
    expect(confirm).toContain('body.tollPointId');
    expect(confirm).toContain("eq(tollTariffImports.status, 'PREVIEW')");
  });

  it('uses an atomic claim, idempotent response, transaction, rollback-safe updates, and bounded source audit', () => {
    expect(confirm).toContain("set({ status: 'CONFIRMING' })");
    expect(confirm).toContain('alreadyConfirmed: true');
    expect(confirm).toContain('db.transaction');
    expect(confirm).toContain("status: 'CONFIRMED'");
    expect(confirm).toContain('filename: imp.originalFilename.slice');
    expect(confirm).toContain('resolvedCount');
  });

  it('reconciles post-apply indexes/checks/default without touching existing setting rows', () => {
    expect(migration).toContain('DROP INDEX IF EXISTS');
    expect(migration).toContain('ADD CONSTRAINT');
    expect(migration).toContain('SET DEFAULT false');
    expect(migration).not.toMatch(/UPDATE\s+"toll_pricing_settings"/i);
  });
});