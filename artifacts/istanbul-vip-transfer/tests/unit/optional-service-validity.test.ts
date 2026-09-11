import { describe, expect, it } from 'vitest';
import { isOptionalServiceRuntimeValid } from '@/lib/optional-service-validity';
import { dedupeOptionalServices } from '@/lib/optional-service-selection';

const valid = { unitAmount: 100, currency: 'TRY', chargeType: 'PER_BOOKING', maximumQuantity: 1 };

describe('optional service runtime validity', () => {
  it.each([
    ['zero amount', { ...valid, unitAmount: 0 }],
    ['negative amount', { ...valid, unitAmount: -1 }],
    ['invalid currency', { ...valid, currency: 'GBP' }],
    ['invalid charge type', { ...valid, chargeType: 'PER_TRIP' }],
    ['quantity below one', { ...valid, maximumQuantity: 0 }],
    ['per booking quantity above one', { ...valid, maximumQuantity: 2 }],
  ])('rejects %s', (_label, service) => {
    expect(isOptionalServiceRuntimeValid(service)).toBe(false);
  });

  it('accepts a positive per-person service up to its configured maximum', () => {
    expect(isOptionalServiceRuntimeValid({
      ...valid, chargeType: 'PER_PERSON', maximumQuantity: 4,
    })).toBe(true);
  });

  it('prefers the exact canonical meet-and-greet row', () => {
    const rows = [
      { id: 'alias', key: 'FLIGHT_MEET_GREET', displayOrder: 0 },
      { id: 'canonical', key: 'flight-meet-greet', displayOrder: 99 },
    ];
    expect(dedupeOptionalServices(rows).map((row) => row.id)).toEqual(['canonical']);
  });

  it('keeps one deterministic winner when only aliases exist', () => {
    const rows = [
      { id: 'later', key: 'flight_meet_and_greet', displayOrder: 10 },
      { id: 'first', key: 'flight-meet-greet', displayOrder: 2 },
    ];
    expect(dedupeOptionalServices(rows).map((row) => row.id)).toEqual(['first']);
  });
});