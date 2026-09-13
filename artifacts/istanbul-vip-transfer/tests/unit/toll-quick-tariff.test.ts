import { describe, expect, it } from 'vitest';
import {
  parseQuickTariffAmount,
  quickTariffIdentity,
  quickTariffInputSchema,
} from '@/lib/toll-quick-tariff';

describe('quick GATE_PAIR tariff contract', () => {
  it('parses Turkish and English grouping/decimal conventions into kuruş', () => {
    expect(parseQuickTariffAmount('1.234,56')).toBe(123_456);
    expect(parseQuickTariffAmount('1,234.56')).toBe(123_456);
    expect(parseQuickTariffAmount('1 234,5 TL')).toBe(123_450);
    expect(parseQuickTariffAmount('125')).toBe(12_500);
  });

  it('rejects ambiguous separators, invalid values, and excess precision', () => {
    for (const value of ['1,234', '1.234', '0', '-1', '12,345', '12,3456', '1,2,3']) {
      expect(() => parseQuickTariffAmount(value)).toThrow();
    }
  });

  it('collapses whitespace and applies Turkish-locale case folding to identity', () => {
    const first = quickTariffIdentity({
      tollPointId: 'point',
      entryGateName: '  IŞIK  TEPE ',
      exitGateName: 'Kestel',
      vehicleClass: 'class_1',
    });
    const second = quickTariffIdentity({
      tollPointId: 'point',
      entryGateName: 'ışık tepe',
      exitGateName: '  KESTEL ',
      vehicleClass: 'CLASS_1',
    });
    expect(first).toBe(second);
  });

  it('keeps amount validation and gate errors field-local in the schema', () => {
    const result = quickTariffInputSchema.safeParse({
      tollPointId: crypto.randomUUID(),
      entryGateName: ' ',
      exitGateName: 'Kestel',
      amount: '1,234',
      vehicleClass: 'class_1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['entryGateName', 'amount']),
      );
    }
  });
});