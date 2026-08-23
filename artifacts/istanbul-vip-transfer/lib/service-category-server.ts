/**
 * lib/service-category-server.ts  — SERVER-ONLY
 *
 * Returns the active service category list from the database, localised.
 * Categories deliberately have no process-local cache: category moves and
 * visibility changes must be visible to every public request immediately.
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

/** Retained as a no-op compatibility boundary for mutation handlers. */
export function invalidateServiceCategories(): void {
  // Public reads are intentionally uncached.
}

/** Returns active categories for a given locale, ordered by sort_order. */
export async function getServiceCategories(locale: string): Promise<ServiceCategoryItem[]> {
  try {
    const rows = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true))
      .orderBy(asc(serviceCategories.sortOrder));

    const allLocales = ['tr','en','de','ar','ru','es','fr','it','nl'];
    const requestedLocale = allLocales.includes(locale) ? locale : 'en';
    return rows.map(r => ({
      id:        r.id,
      slug:      r.slug,
      label:     ((r.nameTranslations as Record<string,string>)[requestedLocale]
               ?? (r.nameTranslations as Record<string,string>)['en']
               ?? r.slug),
      sortOrder: r.sortOrder,
    }));
  } catch {
    return [];
  }
}
