import { describe, expect, it } from 'vitest';
import {
  createFlightMeetGreetStatus,
  flightLookupInputSchema,
} from '@/lib/flight-meet-greet-contract';
import { getAdminApiPermission, getAdminPagePermission } from '@/lib/auth/authorization';

describe('flight meet & greet contract', () => {
  it('normalizes valid flight lookup input and rejects malformed values', () => {
    expect(flightLookupInputSchema.safeParse({
      flightNumber: ' tk- 1981 ',
      flightDate: '2026-08-22',
    }).data).toEqual({ flightNumber: 'TK1981', flightDate: '2026-08-22' });

    expect(flightLookupInputSchema.safeParse({
      flightNumber: 'not a flight number',
      flightDate: '2026-02-30',
    }).success).toBe(false);
  });

  it('defaults to a closed, unconfigured and safe status', () => {
    const status = createFlightMeetGreetStatus();
    expect(status).toEqual({
      enabled: false,
      provider: { id: 'NONE', label: 'Sağlayıcı yapılandırılmadı', configured: false },
      lookupReady: false,
    });
    expect(JSON.stringify(status).toLowerCase()).not.toContain('key');
    expect(JSON.stringify(status).toLowerCase()).not.toContain('secret');
  });

  it('does not claim lookup readiness for an unimplemented provider', () => {
    const status = createFlightMeetGreetStatus({ enabled: true, providerId: 'FUTURE_PROVIDER' });
    expect(status.enabled).toBe(true);
    expect(status.provider.configured).toBe(false);
    expect(status.lookupReady).toBe(false);
  });
});

describe('flight meet & greet access policy', () => {
  it('limits status management to site settings administrators', () => {
    expect(getAdminApiPermission('/admin/api/flight-meet-greet', 'GET')).toBe('SITE_SETTINGS_MANAGE');
    expect(getAdminApiPermission('/admin/api/flight-meet-greet', 'PUT')).toBe('SITE_SETTINGS_MANAGE');
    expect(getAdminPagePermission('/admin/ucus-karsilama')).toBe('SITE_SETTINGS_MANAGE');
  });
});