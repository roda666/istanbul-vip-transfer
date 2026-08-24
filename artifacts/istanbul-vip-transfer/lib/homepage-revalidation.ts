import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CHROME_TAG } from '@/lib/public-chrome-cache';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import {
  localizedServiceCategoryPath,
  localizedServicePath,
  localizedStaticPath,
} from '@/lib/localized-service-path';

export function revalidateHomepageLocale(locale: string): void {
  revalidatePath(locale === 'tr' ? '/' : `/${locale}`);
  revalidateTag(PUBLIC_CHROME_TAG);
}

/**
 * Service title, excerpt, ordering, active state and homepage visibility are
 * shared by every localized homepage service grid.
 */
export function revalidateAllHomepagesForServiceChange(): void {
  revalidateHomepageLocale('tr');
  for (const locale of SUPPORTED_LANGS) {
    revalidateHomepageLocale(locale);
  }
}

/** A localized service card can change independently of the Turkish source. */
export function revalidateHomepageForServiceTranslation(locale: string): void {
  revalidateHomepageLocale(locale);
}

/**
 * Invalidate every public surface derived from service/category placement.
 * Passing a locale limits localized translation updates; source/category
 * mutations use the default full public language set.
 */
export function revalidatePublicServiceCatalog(options: {
  categorySlugs?: Array<string | null | undefined>;
  locales?: string[];
} = {}): void {
  const locales = options.locales?.length
    ? [...new Set(options.locales)]
    : [...new Set(['tr', ...SUPPORTED_LANGS])];
  const categorySlugs = [...new Set(
    (options.categorySlugs ?? []).filter((slug): slug is string => Boolean(slug)),
  )];

  // Header/Footer receive their catalog through the root public layout.
  revalidateTag(PUBLIC_CHROME_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/sitemap.xml');

  for (const locale of locales) {
    revalidateHomepageLocale(locale);
    revalidatePath(localizedStaticPath('hizmetler', locale));
    for (const categorySlug of categorySlugs) {
      revalidatePath(localizedServiceCategoryPath(categorySlug, locale));
    }
  }
}

/** Flush the page and metadata cache for every localized detail route. */
export function revalidatePublicServiceDetail(slug: string, locales?: string[]): void {
  const targetLocales = locales?.length
    ? [...new Set(locales)]
    : [...new Set(['tr', ...SUPPORTED_LANGS])];
  for (const locale of targetLocales) {
    revalidatePath(localizedServicePath(slug, locale));
  }
  // Detail pages can contribute to sitemap URLs and header/footer navigation.
  revalidatePath('/sitemap.xml');
  revalidateTag(PUBLIC_CHROME_TAG);
}