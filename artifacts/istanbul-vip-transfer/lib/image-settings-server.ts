/**
 * lib/image-settings-server.ts  —  SERVER-ONLY
 *
 * Admin-configurable ceiling (KB) for permanent WebP uploads. Any image
 * above this size is automatically recompressed (lower quality / higher
 * encoder effort, same 1600x900 dimensions) before being kept, so mobile
 * visitors never pay for an oversized in-content image.
 *
 * Same singleton `site_settings` row (id = 1) as site-settings-server.ts,
 * cached separately with the same 5-minute TTL pattern. Call
 * `invalidateImageSettings()` after any admin write to the settings row.
 */
import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { siteSettings } from '@/db/schema';

const DEFAULT_MAX_KB = 200;
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

let _cached: number | null = null;
let _cachedAt = 0;

/** Clear the module-level cache so the next call re-reads from the DB. */
export function invalidateImageSettings(): void {
  _cached = null;
  _cachedAt = 0;
}

/** Returns the configured image-compression threshold in KB (cached). */
export async function getImageCompressionMaxKb(): Promise<number> {
  if (_cached !== null && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }
  try {
    const rows = await db
      .select({ imageCompressionMaxKb: siteSettings.imageCompressionMaxKb })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    const value = rows[0]?.imageCompressionMaxKb;
    if (typeof value !== 'number' || value <= 0) return DEFAULT_MAX_KB;

    _cached = value;
    _cachedAt = Date.now();
    return _cached;
  } catch {
    return DEFAULT_MAX_KB;
  }
}
