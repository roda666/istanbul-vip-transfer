import { getDictionary } from '@/lib/i18n';
import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import { localePath } from '@/lib/locale-path';
import { slugify } from '@/lib/ai/slugify';
import { SLUG_TO_PAGE_KEY } from '@/lib/service-page-config';

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
};

const STATIC_NAV_KEYS: Record<string, keyof ReturnType<typeof getDictionary>['nav']> = {
  hizmetler: 'services',
  araclar: 'vehicles',
  hakkimizda: 'about',
  iletisim: 'contact',
};

const SERVICE_SLUGS = new Set(Object.keys(SLUG_TO_PAGE_KEY));
const STATIC_SLUGS = new Set(Object.keys(STATIC_NAV_KEYS));

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

/** Returns the canonical Turkish static slug for a localized or legacy route segment. */
export function resolveLocalizedStaticSlug(routeSlug: string, locale: string): string | null {
  if (!routeSlug || routeSlug.includes('/')) return null;
  if (locale === 'tr') return STATIC_SLUGS.has(routeSlug) ? routeSlug : null;

  // Locale-prefixed Turkish static slugs remain valid solely for redirects.
  if (STATIC_SLUGS.has(routeSlug)) return routeSlug;

  for (const canonicalSlug of STATIC_SLUGS) {
    if (localizedStaticPath(canonicalSlug, locale).split('/').at(-1) === routeSlug) {
      return canonicalSlug;
    }
  }
  return null;
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

  return localePath(pathname, targetLocale);
}

/**
 * Rewrites a service pathname while changing locale. Static routes retain their
 * existing locale-path behaviour unless they are registered public static pages.
 */
export function localizedPathForLanguageSwitch(pathname: string, targetLocale: string): string {
  return localizedPublicPath(pathname, targetLocale);
}