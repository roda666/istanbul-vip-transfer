import { getDictionary, SUPPORTED_LANGS } from '@/lib/i18n';
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

const SERVICE_SLUGS = new Set(Object.keys(SLUG_TO_PAGE_KEY));

/** Builds the public path for a canonical service slug in the requested locale. */
export function localizedServicePath(canonicalSlug: string, locale: string): string {
  if (locale === 'tr') return `/${canonicalSlug}`;

  const navKey = SERVICE_NAV_KEYS[canonicalSlug];
  if (!navKey || !SUPPORTED_LANGS.includes(locale as typeof SUPPORTED_LANGS[number])) {
    return localePath(`/${canonicalSlug}`, locale);
  }

  // Airport IATA codes are useful visible labels but add no search value to
  // a URL and make the canonical slug needlessly noisy.
  const translatedLabel = getDictionary(locale).nav[navKey].replace(/\s*\([^)]*\)/g, '');
  return `/${locale}/${slugify(translatedLabel, canonicalSlug)}`;
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
 * Rewrites a service pathname while changing locale. Static routes retain their
 * existing locale-path behaviour; only registered service URLs get a translated
 * final segment.
 */
export function localizedPathForLanguageSwitch(pathname: string, targetLocale: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const currentLocale = SUPPORTED_LANGS.includes(segments[0] as typeof SUPPORTED_LANGS[number])
    ? segments.shift()!
    : 'tr';

  if (segments.length === 1) {
    const canonicalSlug = resolveLocalizedServiceSlug(segments[0], currentLocale);
    if (canonicalSlug) return localizedServicePath(canonicalSlug, targetLocale);
  }

  return localePath(pathname, targetLocale);
}