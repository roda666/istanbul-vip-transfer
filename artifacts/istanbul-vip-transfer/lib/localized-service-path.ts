import { getDictionary } from '@/lib/i18n';
import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import { localePath } from '@/lib/locale-path';
import { slugify } from '@/lib/ai/slugify';
import { SLUG_TO_PAGE_KEY } from '@/lib/service-page-config';
import { STATIC_PAGE_SLUGS } from '@/lib/static-page-slugs';

const SERVICE_NAV_KEYS: Record<string, keyof ReturnType<typeof getDictionary>['nav']> = {
  'istanbul-havalimani-transfer': 'istTransfer',
  'sabiha-gokcen-havalimani-transfer': 'sawTransfer',
  'vip-transfer': 'vipTransfer',
  'sehirler-arasi-transfer': 'intercityTransfer',
  'soforlu-arac-kiralama': 'chauffeur',
  'otel-transfer': 'hotelTransfer',
  'saglik-turizmi-transfer': 'healthTransfer',
  'kurumsal-vip-transfer': 'corporateTransfer',
  'istanbul-bursa-transfer': 'istBursaRoute',
  'istanbul-sapanca-transfer': 'istSapancaRoute',
  'istanbul-gunubirlik-turlar': 'istDayTours',
  'sapanca-masukiye-turu': 'sapancaTour',
  'bursa-gunubirlik-tur': 'bursaTour',
  'yalova-gunubirlik-tur': 'yalovaTour',
  'gelin-arabasi-kiralama': 'weddingCarRental',
  'gunluk-villa-kiralama': 'dailyVillaRental',
  'ucus-karsilama-meet-greet': 'meetGreetService',
  'vip-protokol-secim-araci': 'vipProtocolVehicle',
};

const STATIC_NAV_KEYS: Record<string, keyof ReturnType<typeof getDictionary>['nav']> = {
  hizmetler: 'services',
  araclar: 'vehicles',
  hakkimizda: 'about',
  iletisim: 'contact',
};

// Route resolution must recognize every slug that can produce a translated
// locale path, not just the subset with a PageHero fallback (SLUG_TO_PAGE_KEY).
// Otherwise a canonical slug added only to SERVICE_NAV_KEYS gets a translated
// outbound link but 404s on the way back in, since resolveLocalizedServiceSlug()
// can only match slugs it iterates over.
const SERVICE_SLUGS = new Set([
  ...Object.keys(SLUG_TO_PAGE_KEY),
  ...Object.keys(SERVICE_NAV_KEYS),
]);
// Every scaffolded WebPage is routable in every locale. The original four
// navigation-backed pages get translated URL segments from STATIC_NAV_KEYS;
// pages without a dictionary nav key keep their canonical slug after /<locale>.
const STATIC_SLUGS = new Set(STATIC_PAGE_SLUGS);
// Existing admin-created categories use underscores (for example `city_vip`);
// keep those persistent slugs routable alongside conventional hyphenated ones.
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/** Builds the public path for a canonical service slug in the requested locale. */
export function localizedServicePath(canonicalSlug: string, locale: string): string {
  if (locale === 'tr') return `/${canonicalSlug}`;

  const navKey = SERVICE_NAV_KEYS[canonicalSlug];
  if (!navKey) {
    return localePath(`/${canonicalSlug}`, locale);
  }

  // Airport IATA codes are useful visible labels but add no search value to
  // a URL and make the canonical slug needlessly noisy.
  const translatedLabel = getDictionary(locale).nav[navKey].replace(/\s*\([^)]*\)/g, '');
  return `/${locale}/${slugify(translatedLabel, canonicalSlug)}`;
}

/** Builds the public path for a canonical static page slug in the requested locale. */
export function localizedStaticPath(canonicalSlug: string, locale: string): string {
  if (locale === 'tr') return `/${canonicalSlug}`;

  const navKey = STATIC_NAV_KEYS[canonicalSlug];
  if (!navKey) {
    return localePath(`/${canonicalSlug}`, locale);
  }

  return `/${locale}/${slugify(getDictionary(locale).nav[navKey], canonicalSlug)}`;
}

/** Builds a locale-aware, browsable service-category URL. */
export function localizedServiceCategoryPath(categorySlug: string, locale: string): string {
  return `${localizedStaticPath('hizmetler', locale)}/${categorySlug}`;
}

/** Builds the stable, locale-aware public URL for a transfer-route detail page. */
export function localizedTransferRoutePath(routeSlug: string, locale: string): string {
  return locale === 'tr' ? `/guzergah/${routeSlug}` : `/${locale}/guzergah/${routeSlug}`;
}

/**
 * Resolves a two-segment service-category route. Category validity is checked
 * against the active database catalog by the route that renders it.
 */
export function resolveLocalizedServiceCategoryPath(routePath: string, locale: string): string | null {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length !== 2 || !CATEGORY_SLUG_PATTERN.test(segments[1])) return null;

  return resolveLocalizedStaticSlug(segments[0], locale) === 'hizmetler'
    ? segments[1]
    : null;
}

/** Returns the canonical Turkish CMS slug for a localized or legacy route segment. */
export function resolveLocalizedServiceSlug(routeSlug: string, locale: string): string | null {
  if (!routeSlug || routeSlug.includes('/')) return null;
  if (locale === 'tr') return SERVICE_SLUGS.has(routeSlug) ? routeSlug : null;

  // Locale-prefixed Turkish slugs remain accepted so they can be redirected.
  if (SERVICE_SLUGS.has(routeSlug)) return routeSlug;

  for (const canonicalSlug of SERVICE_SLUGS) {
    if (localizedServicePath(canonicalSlug, locale).split('/').at(-1) === routeSlug) {
      return canonicalSlug;
    }
  }
  return null;
}

/**
 * Resolves a static route against an explicit slug set.
 * Exported so the scaffold contract can be tested with a not-yet-registered
 * fixture slug without mutating the production registry.
 */
export function resolveLocalizedStaticSlugFromSet(
  routeSlug: string,
  locale: string,
  staticSlugs: ReadonlySet<string>,
): string | null {
  if (!routeSlug || routeSlug.includes('/')) return null;
  if (locale === 'tr') return staticSlugs.has(routeSlug) ? routeSlug : null;

  // Locale-prefixed Turkish static slugs remain valid solely for redirects.
  if (staticSlugs.has(routeSlug)) return routeSlug;

  for (const canonicalSlug of staticSlugs) {
    if (localizedStaticPath(canonicalSlug, locale).split('/').at(-1) === routeSlug) {
      return canonicalSlug;
    }
  }
  return null;
}

/** Returns the canonical Turkish static slug for a localized or legacy route segment. */
export function resolveLocalizedStaticSlug(routeSlug: string, locale: string): string | null {
  return resolveLocalizedStaticSlugFromSet(routeSlug, locale, STATIC_SLUGS);
}

/**
 * Builds a locale-aware public path for recognized static or service pages.
 * Unknown paths preserve the existing generic prefix-only behaviour.
 */
export function localizedPublicPath(pathname: string, targetLocale: string): string {
  const suffixIndex = pathname.search(/[?#]/);
  const basePath = suffixIndex === -1 ? pathname : pathname.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : pathname.slice(suffixIndex);
  const segments = basePath.split('/').filter(Boolean);
  const sourceLocale = isLocaleCodeSyntax(segments[0] ?? '') && segments[0] !== 'tr'
    ? segments.shift()!
    : 'tr';

  if (segments.length === 1) {
    const routeSlug = segments[0];
    const serviceSlug = resolveLocalizedServiceSlug(routeSlug, sourceLocale);
    if (serviceSlug) return localizedServicePath(serviceSlug, targetLocale) + suffix;

    const staticSlug = resolveLocalizedStaticSlug(routeSlug, sourceLocale);
    if (staticSlug) return localizedStaticPath(staticSlug, targetLocale) + suffix;
  }

  if (segments.length === 2) {
    if (segments[0] === 'guzergah') {
      return localizedTransferRoutePath(segments[1], targetLocale) + suffix;
    }
    const categorySlug = resolveLocalizedServiceCategoryPath(segments.join('/'), sourceLocale);
    if (categorySlug) return localizedServiceCategoryPath(categorySlug, targetLocale) + suffix;
  }

  return localePath(pathname, targetLocale);
}

/**
 * Rewrites a service pathname while changing locale. Static routes retain their
 * existing locale-path behaviour unless they are registered public static pages.
 */
export function localizedPathForLanguageSwitch(pathname: string, targetLocale: string): string {
  return localizedPublicPath(pathname, targetLocale);
}