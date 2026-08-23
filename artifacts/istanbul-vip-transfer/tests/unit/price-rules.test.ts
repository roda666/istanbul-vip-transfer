import { describe, expect, it } from 'vitest';
import {
  isSupportedPriceCurrency,
  selectApplicablePriceRule,
} from '@/lib/price-rules';
import { getAdminApiPermission, getAdminPagePermission } from '@/lib/auth/authorization';

describe('legacy fixed price rules', () => {
  it('accepts only the configured, non-converted currencies', () => {
    expect(isSupportedPriceCurrency('EUR')).toBe(true);
    expect(isSupportedPriceCurrency('TRY')).toBe(true);
    expect(isSupportedPriceCurrency('USD')).toBe(true);
    expect(isSupportedPriceCurrency('ZZZ')).toBe(false);
  });

  it('uses active status only, even for historic rules with expired dates', () => {
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
    expect(selectApplicablePriceRule([older, expired, newer])?.amount).toBe(9000);
  });
});

describe('price calculator access policy', () => {
  it('keeps price-rule management behind the existing fleet permission', () => {
    expect(getAdminApiPermission('/admin/api/price-rules', 'GET')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/price-rules/example', 'DELETE')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/price-calculator', 'PUT')).toBe('FLEET_MANAGE');
    expect(getAdminPagePermission('/admin/fiyat-kurallari')).toBe('FLEET_MANAGE');
  });

  it('maps every admin-only pricing endpoint before middleware can deny it', () => {
    expect(getAdminApiPermission('/admin/api/pricing/profiles', 'GET')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/pricing/profiles', 'POST')).toBe('FLEET_MANAGE');
    expect(getAdminApiPermission('/admin/api/pricing/settings', 'PUT')).toBe('SITE_SETTINGS_MANAGE');
    expect(getAdminApiPermission('/admin/api/pricing/exchange-rates', 'POST')).toBe('SITE_SETTINGS_MANAGE');
    expect(getAdminApiPermission('/admin/api/pricing/quote', 'POST')).toBe('RESERVATIONS_MANAGE');
  });
});