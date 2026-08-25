import { describe, expect, it } from 'vitest';
import { calculateAdminQuote } from '@/lib/admin-pricing-engine';

const common = {
  vehicleEligible: true,
  tripType: 'ONE_WAY' as const,
  vatRateBasisPoints: 2000,
  vatDisplayMode: 'EXCLUDED' as const,
  rates: { eurTryMicros: 35_000_000, eurUsdMicros: 1_100_000 },
  rounding: { eurCents: 500, usdCents: 500, tryKurus: 5000 },
};

describe('admin pricing engine', () => {
  const distanceProfile = { mode: 'DISTANCE' as const, openingKurus: 1_000, firstKmKurus: 100, thresholdKm: 10, secondKmKurus: 50 };

  it('keeps the distance formula continuous around the threshold', () => {
    const atThreshold = calculateAdminQuote({ ...common, profile: distanceProfile, distanceKm: 10 });
    const afterThreshold = calculateAdminQuote({ ...common, profile: distanceProfile, distanceKm: 11 });
    expect(atThreshold).toMatchObject({ state: 'AVAILABLE', netTryKurus: 2_000 });
    expect(afterThreshold).toMatchObject({ state: 'AVAILABLE', netTryKurus: 2_050 });
  });

  it('continues the first kilometre tariff when the optional second tier is empty', () => {
    const result = calculateAdminQuote({
      ...common,
      profile: { ...distanceProfile, openingKurus: 0, thresholdKm: 100, secondKmKurus: 0 },
      distanceKm: 200,
    });
    expect(result).toMatchObject({ state: 'AVAILABLE', netTryKurus: 20_000 });
    if (result.state === 'AVAILABLE') {
      expect(result.lines).toContainEqual(expect.objectContaining({
        key: 'distance-second-tier',
        amountKurus: 10_000,
        label: 'Tek tarife devamı (100 km)',
      }));
    }
  });

  it('applies minimum-hour and kilometre excesses independently', () => {
    const result = calculateAdminQuote({
      ...common,
      profile: { mode: 'HOURLY', hourlyRateKurus: 2_000, minimumHours: 4, includedKmMode: 'PER_HOUR', includedKm: 10, excessKmKurus: 100, excessHourKurus: 1_500 },
      distanceKm: 55,
      requestedHours: 5,
    });
    expect(result).toMatchObject({ state: 'AVAILABLE', effectiveHours: 5, includedKmAllowance: 50, netTryKurus: 10_000 });
  });

  it('can quote distance and hourly pricing independently for one eligible vehicle', () => {
    const distanceQuote = calculateAdminQuote({ ...common, profile: distanceProfile, distanceKm: 20 });
    const hourlyQuote = calculateAdminQuote({
      ...common,
      profile: { mode: 'HOURLY', hourlyRateKurus: 2_000, minimumHours: 4, includedKmMode: 'PACKAGE', includedKm: 100, excessKmKurus: 100, excessHourKurus: 1_500 },
      distanceKm: 20,
      requestedHours: 4,
    });
    expect(distanceQuote).toMatchObject({ state: 'AVAILABLE', formulaKind: 'DISTANCE' });
    expect(hourlyQuote).toMatchObject({ state: 'AVAILABLE', formulaKind: 'HOURLY' });
  });

  it.each([
    [1, 8_000],
    [4, 8_000],
    [5, 9_500],
  ])('bills the minimum allocation correctly at %s requested hours', (requestedHours, expectedKurus) => {
    const result = calculateAdminQuote({
      ...common,
      profile: { mode: 'HOURLY', hourlyRateKurus: 2_000, minimumHours: 4, includedKmMode: 'PACKAGE', includedKm: 100, excessKmKurus: 100, excessHourKurus: 1_500 },
      distanceKm: 1,
      requestedHours,
    });
    expect(result).toMatchObject({ state: 'AVAILABLE', effectiveHours: Math.max(requestedHours, 4), netTryKurus: expectedKurus });
  });

  it('uses rounded EUR as the single source for customer USD and TRY', () => {
    const result = calculateAdminQuote({ ...common, profile: distanceProfile, distanceKm: 1 });
    expect(result).toMatchObject({ state: 'AVAILABLE', quotedEurCents: 500, quotedUsdCents: 1000, quotedTryKurus: 20000 });
  });

  it('includes tolls in round-trip net, VAT, and converted rounded totals', () => {
    const result = calculateAdminQuote({
      ...common,
      profile: distanceProfile,
      distanceKm: 10,
      tripType: 'ROUND_TRIP',
      tolls: [{ id: 'bridge-1', name: 'Test Köprüsü', amountKurus: 3_000 }],
    });

    expect(result).toMatchObject({
      state: 'AVAILABLE',
      netTryKurus: 10_000,
      vatTryKurus: 2_000,
      grossTryKurus: 12_000,
      quotedEurCents: 500,
      quotedUsdCents: 1_000,
      quotedTryKurus: 20_000,
    });
    if (result.state === 'AVAILABLE') {
      expect(result.lines).toContainEqual({
        key: 'toll:bridge-1',
        label: 'Test Köprüsü',
        amountKurus: 6_000,
        visibleToCustomer: false,
      });
    }
  });

  it('never reveals a price for an ineligible vehicle', () => {
    expect(calculateAdminQuote({ ...common, vehicleEligible: false, profile: distanceProfile, distanceKm: 5 }))
      .toEqual({ state: 'ON_REQUEST', reason: 'VEHICLE_NOT_ELIGIBLE' });
  });
});