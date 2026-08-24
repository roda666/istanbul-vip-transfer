import { describe, expect, it } from 'vitest';
import { currentlyApplicable } from '@/lib/admin-pricing-service';

describe('fixed price override validity selection', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');

  it('does not let expired or future overrides replace the active formula price', () => {
    const expired = {
      id: 'expired',
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
      validUntil: new Date('2026-08-23T23:59:59.999Z'),
    };
    const future = {
      id: 'future',
      validFrom: new Date('2026-08-25T00:00:00.000Z'),
      validUntil: null,
    };
    expect(currentlyApplicable([expired, future], now)).toBeUndefined();
  });

  it('uses the newest currently valid override when one exists', () => {
    const older = {
      id: 'older',
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
      validUntil: new Date('2026-08-31T23:59:59.999Z'),
    };
    const current = {
      id: 'current',
      validFrom: new Date('2026-08-20T00:00:00.000Z'),
      validUntil: null,
    };
    expect(currentlyApplicable([older, current], now)?.id).toBe('current');
  });
});