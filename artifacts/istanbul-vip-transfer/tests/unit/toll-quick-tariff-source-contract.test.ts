import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL(
  '../../app/admin/api/pricing/tolls/tariffs/quick/route.ts',
  import.meta.url,
), 'utf8');

describe('quick tariff API source contract', () => {
  it('uses a transaction lock and writes the validated period as a manual date-bound tariff without source/map evidence', () => {
    expect(route).toContain('db.transaction');
    expect(route).toContain('pg_advisory_xact_lock');
    expect(route).toContain('timeBand: payload.data.timeBand');
    expect(route).toContain('tollTimeBandFlags(payload.data.timeBand)');
    expect(route).toContain('manualAmountKurus: amountKurus');
    expect(route).toContain("sourceName: 'Manuel hızlı tarife girişi'");
    expect(route).toContain('sourceUrl: null');
    expect(route).toContain('queriedAt: null');
    expect(route).toContain('getIstanbulDayBounds');
  });

  it('keeps the duplicate error wording stable', () => {
    expect(route).toContain('Bu sınıf ve zaman dilimi için bu gişe çiftinin tarifesi zaten var; mevcut tarifeyi Düzenle ile güncelleyin');
  });
});