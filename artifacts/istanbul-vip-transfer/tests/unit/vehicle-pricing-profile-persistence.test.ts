import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { selectPricingProfilesForEditor } from '../../lib/vehicle-pricing-profile-selection';

describe('vehicle pricing profile persistence', () => {
  it('loads the latest saved formula for both modes while selecting the active one', () => {
    const latestHourly = { id: 'hourly-latest', mode: 'HOURLY' as const, active: true, hourlyRateKurus: 45_000 };
    const latestDistance = { id: 'distance-latest', mode: 'DISTANCE' as const, active: false, distanceFirstKmKurus: 6_500 };
    const olderDistance = { id: 'distance-old', mode: 'DISTANCE' as const, active: false, distanceFirstKmKurus: 5_000 };

    const result = selectPricingProfilesForEditor([latestHourly, latestDistance, olderDistance]);

    expect(result.selectedMode).toBe('HOURLY');
    expect(result.byMode.HOURLY).toBe(latestHourly);
    expect(result.byMode.DISTANCE).toBe(latestDistance);
  });

  it('falls back to the most recently saved mode when no formula is active', () => {
    const latestHourly = { id: 'hourly-latest', mode: 'HOURLY' as const, active: false };
    const latestDistance = { id: 'distance-latest', mode: 'DISTANCE' as const, active: false };

    expect(selectPricingProfilesForEditor([latestHourly, latestDistance]).selectedMode).toBe('HOURLY');
    expect(selectPricingProfilesForEditor([latestHourly]).selectedMode).toBe('HOURLY');
  });

  it('deactivates active formulas for the whole vehicle, not only the selected mode', () => {
    const source = readFileSync(
      resolve(__dirname, '../../app/admin/api/pricing/profiles/route.ts'),
      'utf8',
    );
    const postDeactivation = source.match(
      /await tx\.update\(vehiclePricingProfiles\)\.set\(\{[\s\S]*?\}\)\.where\(and\(([\s\S]*?)\)\);\s*return tx\.insert/,
    );

    expect(postDeactivation?.[1]).toContain('vehiclePricingProfiles.vehicleId');
    expect(postDeactivation?.[1]).toContain('vehiclePricingProfiles.active');
    expect(postDeactivation?.[1]).not.toContain('vehiclePricingProfiles.mode');
  });
});