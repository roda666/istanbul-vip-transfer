import { describe, expect, it } from 'vitest';
import {
  assertTariffTimeBandForPointType,
  assertTypeMatchesPricingMode,
  resolveTariffBandForPoint,
  resolveVehicleTollClass,
  tariffAppliesToBand,
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
  it('uses a point exception when present and otherwise falls back to the selected vehicle class', () => {
    expect(resolveVehicleTollClass('class_3', 'class_2')).toBe('class_3');
    expect(resolveVehicleTollClass(null, 'class_2')).toBe('class_2');
    expect(resolveVehicleTollClass(undefined, null)).toBeNull();
  });

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

  it('allows only one all-day tariff band for ferry and highway points', () => {
    expect(() => assertTariffTimeBandForPointType('FERRY', 'ALL')).not.toThrow();
    expect(() => assertTariffTimeBandForPointType('FERRY', 'DAY')).toThrow();
    expect(() => assertTariffTimeBandForPointType('FERRY', 'NIGHT')).toThrow();
    expect(() => assertTariffTimeBandForPointType('HIGHWAY', 'ALL')).not.toThrow();
  });
});

describe('shared toll tariff band resolution', () => {
  it('uses only the all-day ferry price regardless of cutovers or clock time', () => {
    const tariffs = [
      { timeBand: 'ALL' as const, appliesDay: true, appliesNight: true },
      ...dayNightTariffs,
    ];
    const resolution = resolveTariffBandForPoint(
      new Date('2026-01-01T00:00:00.000Z'),
      ferry(null, null),
      tariffs,
    );
    expect(resolution).toEqual({ status: 'RESOLVED', band: 'ALL', allOnly: true });
    if (resolution.status !== 'RESOLVED') throw new Error('Expected ferry band to resolve');
    expect(tariffs.filter((tariff) => tariffAppliesToBand(tariff, resolution)).map((tariff) => tariff.timeBand))
      .toEqual(['ALL']);
  });
});