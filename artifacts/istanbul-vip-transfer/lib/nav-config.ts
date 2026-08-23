/**
 * Locale-aware navigation factory.
 * Both desktop and mobile menus consume getNav(lang, dict).
 */
import type { Dictionary } from '@/lib/i18n/types';
import { localizedPublicPath, localizedServicePath } from '@/lib/localized-service-path';
import type { PublicServiceNavigationGroup } from '@/lib/public-service-catalog-types';

export interface NavItem {
  label: string;
  href: string;
  /** DB slug of the service page — used to filter items where showInNav=false. */
  slug?: string;
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/** A single top-level navigation entry. */
export interface NavEntry {
  label: string;
  /** Present when the entry is a plain link. */
  href?: string;
  /** Present when the entry owns a mega-menu dropdown. */
  groups?: NavGroup[];
  /** Renders as a CTA/outlined button rather than a plain text link. */
  cta?: boolean;
}

/**
 * Returns the full navigation config for the given language.
 * All hrefs are locale-prefixed via localePath.
 *
 * @param serviceNavigationGroups — published, active service groups assembled
 *   from the CMS by the root server layout. This keeps category moves and new
 *   services in sync with every header variant.
 */
export function getNav(
  lang: string,
  dict: Dictionary,
  serviceNavigationGroups: PublicServiceNavigationGroup[] = [],
): NavEntry[] {
  const p = (path: string) => localizedPublicPath(path, lang);
  const servicePath = (slug: string) => localizedServicePath(slug, lang);
  const groups: NavGroup[] = serviceNavigationGroups.map((group) => ({
    groupLabel: group.label,
    items: group.items.map((item) => ({
      slug: item.slug,
      label: item.label,
      href: servicePath(item.slug),
    })),
  }));

  return [
    { label: dict.nav.home, href: p('/') },
    {
      label: dict.nav.services,
      href: p('/hizmetler'),
      groups,
    },
    { label: dict.nav.vehicles, href: p('/araclar') },
    { label: dict.nav.blog,     href: p('/blog') },
    { label: dict.nav.about,    href: p('/hakkimizda') },
    { label: dict.nav.contact,  href: p('/iletisim') },
    { label: dict.nav.booking,  href: p('/#rezervasyon'), cta: true },
  ];
}

// Keep legacy NAV export for any existing imports (returns Turkish)
import { getDictionary } from '@/lib/i18n';
export const NAV = getNav('tr', getDictionary('tr'));
