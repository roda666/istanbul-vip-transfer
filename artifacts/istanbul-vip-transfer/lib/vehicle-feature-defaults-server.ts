/**
 * lib/vehicle-feature-defaults-server.ts  —  SERVER-ONLY
 *
 * Reads the fleet-wide default amenity codes (id=1 row of
 * `vehicle_feature_defaults`) and returns them as a plain string array. A
 * vehicle with its own `features` always overrides this list — see
 * lib/vehicle-localization.ts. Falls back to DEFAULT_VEHICLE_FEATURE_CODES
 * when the row hasn't been created yet.
 *
 * Module-level cache with a 5-minute TTL, same convention as
 * lib/site-settings-server.ts. Call `invalidateVehicleFeatureDefaults()` from
 * the admin PUT handler so the next request reflects the change immediately.
 */
import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { vehicleFeatureDefaults } from '@/db/schema';
import { DEFAULT_VEHICLE_FEATURE_CODES, isVehicleFeatureCode } from './vehicle-feature-catalog';

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

let _cached: string[] | null = null;
let _cachedAt = 0;

export function invalidateVehicleFeatureDefaults(): void {
  _cached = null;
  _cachedAt = 0;
}

export async function getVehicleFeatureDefaults(): Promise<string[]> {
  if (_cached && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }

  try {
    const rows = await db
      .select()
      .from(vehicleFeatureDefaults)
      .where(eq(vehicleFeatureDefaults.id, 1))
      .limit(1);

    if (rows.length === 0) {
      // Not yet seeded — return sane defaults without caching so the very
      // next request picks up an admin's first save immediately.
      return DEFAULT_VEHICLE_FEATURE_CODES;
    }

    const codes = (rows[0].codes ?? []).filter(isVehicleFeatureCode);
    _cached = codes;
    _cachedAt = Date.now();
    return _cached;
  } catch {
    return DEFAULT_VEHICLE_FEATURE_CODES;
  }
}
