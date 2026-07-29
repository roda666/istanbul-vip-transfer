/**
 * Locale-aware navigation factory.
 * Both desktop and mobile menus consume getNav(lang, dict).
 */
import type { Dictionary } from '@/lib/i18n/types';
import { localePath } from '@/lib/locale-path';

export interface NavItem {
  label: string;
  href: string;
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
 */
export function getNav(lang: string, dict: Dictionary): NavEntry[] {
  const p = (path: string) => localePath(path, lang);
  return [
    { label: dict.nav.home, href: p('/') },
    {
      label: dict.nav.services,
      href: p('/hizmetler'),
      groups: [
        {
          groupLabel: dict.nav.groupAirport,
          items: [
            { label: dict.nav.istTransfer, href: p('/istanbul-havalimani-transfer') },
            { label: dict.nav.sawTransfer, href: p('/sabiha-gokcen-havalimani-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupSpecial,
          items: [
            { label: dict.nav.vipTransfer,       href: p('/vip-transfer') },
            { label: dict.nav.intercityTransfer, href: p('/sehirler-arasi-transfer') },
            { label: dict.nav.chauffeur,         href: p('/soforlu-arac-kiralama') },
            { label: dict.nav.hotelTransfer,     href: p('/otel-transfer') },
            { label: dict.nav.healthTransfer,    href: p('/saglik-turizmi-transfer') },
            { label: dict.nav.corporateTransfer, href: p('/kurumsal-vip-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupRoutes,
          items: [
            { label: dict.nav.istBursaRoute,   href: p('/istanbul-bursa-transfer') },
            { label: dict.nav.istSapancaRoute, href: p('/istanbul-sapanca-transfer') },
          ],
        },
        {
          groupLabel: dict.nav.groupTours,
          items: [
            { label: dict.nav.istDayTours, href: p('/istanbul-gunubirlik-turlar') },
            { label: dict.nav.sapancaTour, href: p('/sapanca-masukiye-turu') },
            { label: dict.nav.bursaTour,   href: p('/bursa-gunubirlik-tur') },
            { label: dict.nav.yalovaTour,  href: p('/yalova-gunubirlik-tur') },
          ],
        },
      ],
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
