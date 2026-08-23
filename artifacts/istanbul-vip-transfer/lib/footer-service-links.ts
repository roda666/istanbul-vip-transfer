import type { PublicServiceNavigationItem } from '@/lib/public-service-catalog-types';

/**
 * The footer should act as a compact route to the highest-intent services,
 * not duplicate the complete service directory. Everything else remains
 * available through the "All Services" link directly beneath this list.
 */
export const FOOTER_DIRECT_SERVICE_LIMIT = 6;

const FOOTER_PRIORITY_SERVICE_SLUGS = [
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
  'vip-transfer',
  'soforlu-arac-kiralama',
  'sehirler-arasi-transfer',
  'otel-transfer',
] as const;

/**
 * Prioritize core airport, VIP and chauffeur-led services, then retain the
 * CMS order as a fallback when one of those services is unavailable.
 */
export function selectFooterServiceLinks<T extends PublicServiceNavigationItem>(
  serviceLinks: T[],
): T[] {
  const linksBySlug = new Map(serviceLinks.map((service) => [service.slug, service]));
  const prioritySlugs = new Set(FOOTER_PRIORITY_SERVICE_SLUGS);

  const prioritized = FOOTER_PRIORITY_SERVICE_SLUGS.flatMap((slug) => {
    const service = linksBySlug.get(slug);
    return service ? [service] : [];
  });

  const remaining = serviceLinks.filter((service) => !prioritySlugs.has(service.slug as typeof FOOTER_PRIORITY_SERVICE_SLUGS[number]));

  return [...prioritized, ...remaining].slice(0, FOOTER_DIRECT_SERVICE_LIMIT);
}