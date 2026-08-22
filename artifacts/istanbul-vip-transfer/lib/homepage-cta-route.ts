import { localizedPublicPath } from '@/lib/localized-service-path';

export type HomepageCtaAction =
  | { kind: 'hash'; target: string }
  | { kind: 'navigate'; href: string };

/**
 * Resolves a homepage CMS CTA without allowing protocol-relative or unsafe URLs.
 * Canonical internal routes are localized before navigation.
 */
export function resolveHomepageCtaAction(
  ctaRoute: string | undefined | null,
  locale: string,
): HomepageCtaAction {
  const route = ctaRoute?.trim();

  if (!route) return { kind: 'hash', target: '#rezervasyon' };
  // Browsers normalize backslashes in URL paths, which can turn a seemingly
  // internal `/\host` value into a protocol-relative external navigation.
  if (route.includes('\\')) return { kind: 'hash', target: '#rezervasyon' };
  if (route.startsWith('#')) return { kind: 'hash', target: route };

  if (route.startsWith('/') && !route.startsWith('//')) {
    return { kind: 'navigate', href: localizedPublicPath(route, locale) };
  }

  try {
    const url = new URL(route);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return { kind: 'navigate', href: url.toString() };
    }
  } catch {
    // Invalid CMS CTA values deliberately retain the safe reservation fallback.
  }

  return { kind: 'hash', target: '#rezervasyon' };
}