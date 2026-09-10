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

  it('deactivates only active formulas in the same vehicle and mode when creating a version', () => {
    const source = readFileSync(
      resolve(__dirname, '../../app/admin/api/pricing/profiles/route.ts'),
      'utf8',
    );
    const postDeactivation = source.match(
      /await tx\.update\(vehiclePricingProfiles\)\.set\(\{[\s\S]*?\}\)\.where\(and\(([\s\S]*?)\)\);\s*return tx\.insert/,
    );

    expect(postDeactivation?.[1]).toContain('vehiclePricingProfiles.vehicleId');
    expect(postDeactivation?.[1]).toContain('vehiclePricingProfiles.mode');
    expect(postDeactivation?.[1]).toContain('data.data.mode');
    expect(postDeactivation?.[1]).toContain('vehiclePricingProfiles.active');
  });

  it('deactivates only active formulas in the same vehicle and mode when reactivating a version', () => {
    const source = readFileSync(
      resolve(__dirname, '../../app/admin/api/pricing/profiles/route.ts'),
      'utf8',
    );
    const patchDeactivation = source.match(
      /if \(payload\.data\.active\) \{[\s\S]*?await tx\.update\(vehiclePricingProfiles\)\.set\(\{[\s\S]*?\}\)\.where\(and\(([\s\S]*?)\)\);\s*\}/,
    );

    expect(patchDeactivation?.[1]).toContain('vehiclePricingProfiles.vehicleId');
    expect(patchDeactivation?.[1]).toContain('vehiclePricingProfiles.mode');
    expect(patchDeactivation?.[1]).toContain('profile.mode');
    expect(patchDeactivation?.[1]).toContain('vehiclePricingProfiles.active');
  });
});