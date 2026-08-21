/**
 * Locale-aware navigation factory.
 * Both desktop and mobile menus consume getNav(lang, dict).
 */
import type { Dictionary } from '@/lib/i18n/types';
import { localizedPublicPath, localizedServicePath } from '@/lib/localized-service-path';

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
 * @param hiddenNavSlugs — slugs whose showInNav flag is false in the CMS.
 *   Pass the result of getServiceVisibilityMap() filtered by !flags.showInNav.
 *   When absent, all items are shown (safe fallback for static callers).
 */
export function getNav(lang: string, dict: Dictionary, hiddenNavSlugs?: Set<string>): NavEntry[] {
  const p = (path: string) => localizedPublicPath(path, lang);
  const servicePath = (slug: string) => localizedServicePath(slug, lang);
  const show = (slug: string) => !hiddenNavSlugs?.has(slug);

  const filterItems = (items: NavItem[]) =>
    items.filter(item => !item.slug || show(item.slug));

  const filterGroups = (groups: NavGroup[]) =>
    groups
      .map(g => ({ ...g, items: filterItems(g.items) }))
      .filter(g => g.items.length > 0);

  return [
    { label: dict.nav.home, href: p('/') },
    {
      label: dict.nav.services,
      href: p('/hizmetler'),
      groups: filterGroups([
        {
          groupLabel: dict.nav.groupAirport,
          items: [
            { slug: 'istanbul-havalimani-transfer',    label: dict.nav.istTransfer, href: servicePath('istanbul-havalimani-transfer') },
            { slug: 'sabiha-gokcen-havalimani-transfer', label: dict.nav.sawTransfer, href: servicePath('sabiha-gokcen-havalimani-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupSpecial,
          items: [
            { slug: 'vip-transfer',           label: dict.nav.vipTransfer,       href: servicePath('vip-transfer') },
            { slug: 'sehirler-arasi-transfer', label: dict.nav.intercityTransfer, href: servicePath('sehirler-arasi-transfer') },
            { slug: 'soforlu-arac-kiralama',  label: dict.nav.chauffeur,         href: servicePath('soforlu-arac-kiralama') },
            { slug: 'otel-transfer',          label: dict.nav.hotelTransfer,     href: servicePath('otel-transfer') },
            { slug: 'saglik-turizmi-transfer', label: dict.nav.healthTransfer,   href: servicePath('saglik-turizmi-transfer') },
            { slug: 'kurumsal-vip-transfer',  label: dict.nav.corporateTransfer, href: servicePath('kurumsal-vip-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupRoutes,
          items: [
            { slug: 'istanbul-bursa-transfer',   label: dict.nav.istBursaRoute,   href: servicePath('istanbul-bursa-transfer') },
            { slug: 'istanbul-sapanca-transfer',  label: dict.nav.istSapancaRoute, href: servicePath('istanbul-sapanca-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupTours,
          items: [
            { slug: 'istanbul-gunubirlik-turlar', label: dict.nav.istDayTours, href: servicePath('istanbul-gunubirlik-turlar') },
            { slug: 'sapanca-masukiye-turu',      label: dict.nav.sapancaTour, href: servicePath('sapanca-masukiye-turu') },
            { slug: 'bursa-gunubirlik-tur',       label: dict.nav.bursaTour,   href: servicePath('bursa-gunubirlik-tur') },
            { slug: 'yalova-gunubirlik-tur',      label: dict.nav.yalovaTour,  href: servicePath('yalova-gunubirlik-tur') },
          ],
        },
      ]),
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
