/**
 * Resolves the abstract internal-link references authored in
 * `content.internal_links` (e.g. "service:otel-transfer", "blog:some-slug",
 * "route:ist-havalimani-taksim", "cta:quote") into real, locale-aware public
 * paths.
 *
 * Storing an abstract reference instead of a hardcoded href keeps the link
 * correct if a service's localized URL pattern ever changes, and lets a
 * single Turkish-authored link list be reused safely once translated anchor
 * text is added in a later phase.
 */
import { localizedServicePath, localizedTransferRoutePath } from '@/lib/localized-service-path';

export interface ServiceRelatedLink {
  label: string;
  href: string;
  anchor?: string;
}

export interface ResolvedRelatedLink {
  label: string;
  href: string;
  group: 'related-service' | 'related-blog' | 'related-route' | 'quote-cta' | 'other';
}

/** Resolves one stored link reference to a real path for the given locale. */
export function resolveInternalLinkHref(rawHref: string, lang: string): string | null {
  const [kind, ...rest] = rawHref.split(':');
  const value = rest.join(':');

  switch (kind) {
    case 'service':
      return value ? localizedServicePath(value, lang) : null;
    case 'blog':
      // Blog posts do not yet have a locale-aware path helper — the public
      // blog is Turkish-only today, so this only resolves correctly for 'tr'.
      return value ? `/blog/${value}` : null;
    case 'route':
      return value ? localizedTransferRoutePath(value, lang) : null;
    case 'cta':
      // In-page anchor to the booking form section, always present on
      // service pages via <CollapsibleBookingForm />.
      return '#rezervasyon';
    default:
      return null;
  }
}

/**
 * Resolves a full stored link list into renderable links, grouped by type.
 * Drops any entry whose reference cannot be resolved rather than rendering
 * a broken link.
 */
export function resolveServiceRelatedLinks(
  links: ServiceRelatedLink[] | null | undefined,
  lang: string,
): ResolvedRelatedLink[] {
  if (!links || links.length === 0) return [];

  const resolved: ResolvedRelatedLink[] = [];
  for (const link of links) {
    const href = resolveInternalLinkHref(link.href, lang);
    if (!href) continue;
    const group =
      link.anchor === 'related-service' || link.anchor === 'related-blog' ||
      link.anchor === 'related-route' || link.anchor === 'quote-cta'
        ? link.anchor
        : 'other';
    resolved.push({ label: link.label, href, group });
  }
  return resolved;
}
