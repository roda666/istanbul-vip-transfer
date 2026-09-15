import { describe, expect, it } from 'vitest';
import {
  assertTypeMatchesPricingMode,
  resolveTariffBandForPoint,
} from '@/lib/toll-management';
import {
  legacyFerryFlatPointPatchInputSchema,
  tollPointInputSchema,
} from '@/lib/toll-input';

const ferry = (dayStartHour: number | null, nightStartHour: number | null) => ({
  type: 'FERRY',
  dayStartHour,
  nightStartHour,
});

const dayNightTariffs = [
  { timeBand: 'DAY' as const, appliesDay: true, appliesNight: false },
  { timeBand: 'NIGHT' as const, appliesDay: false, appliesNight: true },
];

describe('toll point pricing invariants', () => {
  it('uses GATE_PAIR for ferries and highways but FLAT for bridges and tunnels', () => {
    expect(() => assertTypeMatchesPricingMode('FERRY', 'GATE_PAIR')).not.toThrow();
    expect(() => assertTypeMatchesPricingMode('HIGHWAY', 'GATE_PAIR')).not.toThrow();
    expect(() => assertTypeMatchesPricingMode('BRIDGE', 'FLAT')).not.toThrow();
    expect(() => assertTypeMatchesPricingMode('TUNNEL', 'FLAT')).not.toThrow();
    expect(() => assertTypeMatchesPricingMode('FERRY', 'FLAT')).toThrow();
    expect(() => assertTypeMatchesPricingMode('HIGHWAY', 'FLAT')).toThrow();
  });

  it('keeps legacy FERRY+FLAT editable only through the PATCH compatibility schema', () => {
    const input = { name: 'Legacy Ferry', type: 'FERRY', pricingMode: 'FLAT' };
    expect(tollPointInputSchema.safeParse(input).success).toBe(false);
    expect(legacyFerryFlatPointPatchInputSchema.safeParse(input).success).toBe(true);
  });
});

describe('shared toll tariff band resolution', () => {
  it('keeps legacy ALL tariffs usable without cutover configuration', () => {
    expect(resolveTariffBandForPoint(
      new Date('2026-01-01T00:00:00.000Z'),
      ferry(null, null),
      [{ timeBand: 'ALL', appliesDay: true, appliesNight: true }],
    )).toEqual({ status: 'RESOLVED', band: 'ALL' });
  });

  it('marks ferry DAY/NIGHT tariffs unconfigured without valid cutovers', () => {
    const at = new Date('2026-01-01T12:00:00.000Z');
    expect(resolveTariffBandForPoint(at, ferry(null, null), dayNightTariffs))
      .toEqual({ status: 'UNCONFIGURED', reason: 'MISSING_CUTOVER' });
    expect(resolveTariffBandForPoint(at, ferry(6, 6), dayNightTariffs))
      .toEqual({ status: 'UNCONFIGURED', reason: 'INVALID_CUTOVER' });
    expect(resolveTariffBandForPoint(at, ferry(24, 6), dayNightTariffs))
      .toEqual({ status: 'UNCONFIGURED', reason: 'INVALID_CUTOVER' });
  });

  it('resolves Istanbul calendar-hour boundaries and overnight windows', () => {
    const standard = ferry(6, 22);
    expect(resolveTariffBandForPoint(new Date('2026-01-01T02:59:00.000Z'), standard, dayNightTariffs).band).toBe('NIGHT');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T03:00:00.000Z'), standard, dayNightTariffs).band).toBe('DAY');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T18:59:00.000Z'), standard, dayNightTariffs).band).toBe('DAY');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T19:00:00.000Z'), standard, dayNightTariffs).band).toBe('NIGHT');

    const overnight = ferry(22, 6);
    expect(resolveTariffBandForPoint(new Date('2026-01-01T18:59:00.000Z'), overnight, dayNightTariffs).band).toBe('NIGHT');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T19:00:00.000Z'), overnight, dayNightTariffs).band).toBe('DAY');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T02:59:00.000Z'), overnight, dayNightTariffs).band).toBe('DAY');
    expect(resolveTariffBandForPoint(new Date('2026-01-01T03:00:00.000Z'), overnight, dayNightTariffs).band).toBe('NIGHT');
  });
});