import { describe, expect, it } from 'vitest';
import {
  isSupportedPriceCurrency,
  isPriceRuleActiveAt,
  isValidPriceWindow,
  priceRuleWindowsOverlap,
  selectApplicablePriceRule,
} from '@/lib/price-rules';
import { getAdminApiPermission, getAdminPagePermission } from '@/lib/auth/authorization';

const jan10 = new Date('2026-01-10T12:00:00.000Z');

describe('price rule validity', () => {
  it('accepts only the configured, non-converted currencies', () => {
    expect(isSupportedPriceCurrency('EUR')).toBe(true);
    expect(isSupportedPriceCurrency('TRY')).toBe(true);
    expect(isSupportedPriceCurrency('USD')).toBe(true);
    expect(isSupportedPriceCurrency('ZZZ')).toBe(false);
  });

  it('accepts open-ended and correctly ordered windows', () => {
    expect(isValidPriceWindow(null, null)).toBe(true);
    expect(isValidPriceWindow(new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-31T00:00:00.000Z'))).toBe(true);
    expect(isValidPriceWindow(new Date('2026-01-31T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('treats endpoints as inclusive when detecting an overlap', () => {
    expect(priceRuleWindowsOverlap(
      { validFrom: new Date('2026-01-01T00:00:00.000Z'), validUntil: new Date('2026-01-10T00:00:00.000Z') },
      { validFrom: new Date('2026-01-10T00:00:00.000Z'), validUntil: new Date('2026-01-20T00:00:00.000Z') },
    )).toBe(true);
    expect(priceRuleWindowsOverlap(
      { validFrom: new Date('2026-01-01T00:00:00.000Z'), validUntil: new Date('2026-01-09T23:59:59.999Z') },
      { validFrom: new Date('2026-01-10T00:00:00.000Z'), validUntil: null },
    )).toBe(false);
  });

  it('selects only active, valid rules and resolves stale overlap deterministically', () => {
    const newer = {
      id: 'b', active: true, validFrom: null, validUntil: null,
      updatedAt: new Date('2026-01-09T00:00:00.000Z'), amount: 15000,
    };
    const older = {
      id: 'a', active: true, validFrom: null, validUntil: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'), amount: 12000,
    };
    const expired = {
      id: 'c', active: true, validFrom: null, validUntil: new Date('2026-01-09T23:59:59.999Z'),
      updatedAt: new Date('2026-01-10T00:00:00.000Z'), amount: 9000,
    };
    expect(isPriceRuleActiveAt(expired, jan10)).toBe(false);
    expect(selectApplicablePriceRule([older, expired, newer], jan10)?.amount).toBe(15000);
  });
});

describe('price calculator access policy', () => {
  it('keeps price-rule management behind the existing fleet permission', () => {
    expect(getAdminApiPermission('/admin/api/price-rules', 'GET')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/price-rules/example', 'DELETE')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/price-calculator', 'PUT')).toBe('FLEET_MANAGE');
    expect(getAdminPagePermission('/admin/fiyat-kurallari')).toBe('FLEET_MANAGE');
  });
});