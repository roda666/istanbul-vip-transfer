/**
 * lib/service-category-server.ts  — SERVER-ONLY
 *
 * Returns the active service category list from the database, localised.
 * Results are cached for 5 minutes per request cycle.
 * Call invalidateServiceCategories() from admin mutation handlers.
 */
import 'server-only';
import { db } from '@/db';
import { serviceCategories } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export type ServiceCategoryItem = {
  id:        number;
  slug:      string;
  /** Localised display name. */
  label:     string;
  sortOrder: number;
};

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

let _cache:    Map<string, ServiceCategoryItem[]> | null = null;
let _cachedAt: number = 0;

/** Clear the cache so the next request reads fresh data from the DB. */
export function invalidateServiceCategories(): void {
  _cache    = null;
  _cachedAt = 0;
}

/** Returns active categories for a given locale, ordered by sort_order. */
export async function getServiceCategories(locale: string): Promise<ServiceCategoryItem[]> {
  if (_cache && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cache.get(locale) ?? [];
  }

  try {
    const rows = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true))
      .orderBy(asc(serviceCategories.sortOrder));

    const allLocales = ['tr','en','de','ar','ru','es','fr','it','nl'];
    const newCache   = new Map<string, ServiceCategoryItem[]>();

    for (const loc of allLocales) {
      newCache.set(loc, rows.map(r => ({
        id:        r.id,
        slug:      r.slug,
        label:     ((r.nameTranslations as Record<string,string>)[loc]
                 ?? (r.nameTranslations as Record<string,string>)['en']
                 ?? r.slug),
        sortOrder: r.sortOrder,
      })));
    }

    _cache    = newCache;
    _cachedAt = Date.now();
    return newCache.get(locale) ?? [];
  } catch {
    return [];
  }
}
