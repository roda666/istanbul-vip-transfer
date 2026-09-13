import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildBulkIncreasePreview,
  increaseKurus,
  parseBulkIncreasePercentage,
} from '../../lib/toll-bulk-increase';

const base = {
  vehicleClass: 'class_1',
  timeBand: 'ALL',
  manualAmountKurus: null,
  automaticAmountKurus: null,
  updatedAt: new Date('2026-09-13T00:00:00.000Z'),
};

describe('toll bulk percentage increase', () => {
  it('accepts Turkish comma or dot decimals', () => {
    expect(parseBulkIncreasePercentage('12,5')).toEqual(parseBulkIncreasePercentage('12.5'));
  });

  it('calculates the requested 15 percent examples at kuruş precision', () => {
    const { percentageUnits } = parseBulkIncreasePercentage('15');
    expect(increaseKurus(15_000, percentageUnits)).toBe(17_250);
    expect(increaseKurus(20_000, percentageUnits)).toBe(23_000);
  });

  it('previews only existing priced rows and counts null rows as skipped', () => {
    const preview = buildBulkIncreasePreview([
      { ...base, id: 'a', amountKurus: 15_000 },
      { ...base, id: 'b', vehicleClass: 'class_2', amountKurus: 20_000 },
      { ...base, id: 'c', vehicleClass: 'class_3', amountKurus: null },
    ], '15');
    expect(preview.rows.map((row) => [row.oldAmountKurus, row.newAmountKurus]))
      .toEqual([[15_000, 17_250], [20_000, 23_000]]);
    expect(preview.skippedEmptyCount).toBe(1);
  });

  it('changes the preview hash when a source price changes', () => {
    const first = buildBulkIncreasePreview([{ ...base, id: 'a', amountKurus: 15_000 }], '15');
    const changed = buildBulkIncreasePreview([{ ...base, id: 'a', amountKurus: 15_001 }], '15');
    expect(changed.previewHash).not.toBe(first.previewHash);
  });

  it('keeps apply atomic, stale-safe, idempotent, and in-place', () => {
    const route = readFileSync(
      new URL('../../app/admin/api/pricing/tolls/bulk-increase/route.ts', import.meta.url),
      'utf8',
    );
    expect(route).toContain('db.transaction(async (tx) =>');
    expect(route).toContain('pg_advisory_xact_lock');
    expect(route).toContain('for update');
    expect(route).toContain('current_timestamp');
    expect(route).toContain("metadata}->>'idempotencyKey'");
    expect(route).toContain('preview.previewHash !== applyInput.previewHash');
    expect(route).toContain('tx.update(tollTariffs)');
    expect(route).not.toContain('tx.insert(tollTariffs)');
  });
});