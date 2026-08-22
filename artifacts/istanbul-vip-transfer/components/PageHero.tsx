'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { localizedPublicPath } from '@/lib/localized-service-path';
import type { Dictionary } from '@/lib/i18n/types';
import { isolateLtrValues } from '@/lib/i18n/bidi';

// ── PageKey support ───────────────────────────────────────────────────────────
// Server Components cannot call useLang(). Instead of passing hardcoded Turkish
// strings as props, they pass a `pageKey` and PageHero resolves the correct
// title / subtitle / breadcrumbs from the active locale dictionary.

/** General page keys (hizmetler / araclar / hakkimizda / iletisim). */
type GeneralPageKey = 'services' | 'vehicles' | 'about' | 'contact';

/** Service/tour page keys — one per route in PAGE_MAP. */
type ServicePageKey =
  | 'istHava' | 'sabiha' | 'vipTransfer' | 'sehirlerArasi'
  | 'soforlu' | 'otel' | 'saglik' | 'kurumsal'
  | 'istBursa' | 'istSapanca' | 'istGunubirlik'
  | 'sapanca' | 'bursa' | 'yalova';

export type PageKey = GeneralPageKey | ServicePageKey;

/** Maps a GeneralPageKey to the nav dict key used as the breadcrumb label. */
const GENERAL_NAV_KEY: Record<GeneralPageKey, keyof Dictionary['nav']> = {
  services: 'services',
  vehicles: 'vehicles',
  about:    'about',
  contact:  'contact',
};

/**
 * Service page keys that use a 2-crumb breadcrumb (Home → Page).
 * All other service keys use 3 crumbs (Home → Services → Page).
 */
const TWO_CRUMB_KEYS: ReadonlySet<ServicePageKey> = new Set([
  'istHava', 'sabiha', 'vipTransfer', 'sehirlerArasi',
]);

// ── Props ─────────────────────────────────────────────────────────────────────

interface Crumb {
  label: string;
  href?: string;
}

type PageHeroBase = {
  /** Uploaded or legacy static hero image path. Renders below the subtitle when present. */
  heroImage?: string | null;
  /** Alt text for the hero image. */
  heroImageAlt?: string | null;
  /**
   * Optional badge/pill displayed above the H1 (e.g. "İstanbul Havalimanı").
   * Comes from body.hero.badge in the DB branch. Hidden when empty.
   */
  badge?: string | null;
};

type PageHeroProps = PageHeroBase &
  (
    | {
        pageKey: PageKey;
        breadcrumbs?: never;
        title?: never;
        subtitle?: never;
      }
    | {
        pageKey?: never;
        breadcrumbs: Crumb[];
        title: string;
        subtitle?: string;
      }
  );

// ── Component ─────────────────────────────────────────────────────────────────

export default function PageHero(props: PageHeroProps) {
  const { lang, dict } = useLang();
  const { heroImage, heroImageAlt, badge } = props;
  // Track image load failures so a broken storage URL doesn't leave a broken <img> on the page.
  const [heroImgError, setHeroImgError] = useState(false);

  // Resolve strings — either from pageKey (locale-aware) or from explicit props.
  let title: string;
  let subtitle: string | undefined;
  let breadcrumbs: Crumb[];

  if (props.pageKey) {
    const k = props.pageKey;

    if (k === 'services' || k === 'vehicles' || k === 'about' || k === 'contact') {
      // General page — title/subtitle from pages dict, breadcrumb from nav dict.
      title      = dict.pages[`${k}Title`   as keyof Dictionary['pages']];
      subtitle   = dict.pages[`${k}Subtitle` as keyof Dictionary['pages']];
      breadcrumbs = [
        { label: dict.nav.home,                                  href: '/' },
        { label: dict.nav[GENERAL_NAV_KEY[k]] as string },
      ];
    } else {
      // Service/tour page — title, subtitle, and crumb all from pages dict.
      const sk = k as ServicePageKey;
      title    = dict.pages[`${sk}Title`    as keyof Dictionary['pages']];
      subtitle = dict.pages[`${sk}Subtitle` as keyof Dictionary['pages']];
      const crumb = dict.pages[`${sk}Crumb` as keyof Dictionary['pages']];

      if (TWO_CRUMB_KEYS.has(sk)) {
        breadcrumbs = [
          { label: dict.nav.home,     href: '/' },
          { label: crumb },
        ];
      } else {
        breadcrumbs = [
          { label: dict.nav.home,     href: '/' },
          { label: dict.nav.services, href: '/hizmetler' },
          { label: crumb },
        ];
      }
    }
  } else {
    title       = props.title;
    subtitle    = props.subtitle;
    breadcrumbs = props.breadcrumbs;
  }
  const display = (value: string) => isolateLtrValues(value, lang);

  return (
    <section
      className="relative pt-16 pb-20 text-center overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FFFDF8 0%, #F7F5EF 60%, #EAF2F8 100%)' }}
    >
      {/* Subtle radial accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(199,154,53,0.08) 0%, transparent 60%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8">
        {/* Badge — service category label above H1 */}
        {badge && (
          <div className="ivt-ph-badge inline-flex items-center gap-2 mb-5">
            <span style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'rgba(199,154,53,0.12)',
              color: '#A07820',
              border: '1px solid rgba(199,154,53,0.3)',
            }}>
              {display(badge)}
            </span>
          </div>
        )}

        {/* Breadcrumb */}
        <nav
          className="flex items-center justify-center gap-1.5 mb-8 text-xs flex-wrap"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={11} style={{ color: '#50677A' }} aria-hidden="true" />}
              {crumb.href ? (
                <Link
                  href={localizedPublicPath(crumb.href, lang)}
                  className="transition-colors duration-200 focus:outline-none focus-visible:underline"
                  style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#50677A'; }}
                >
                  {display(crumb.label)}
                </Link>
              ) : (
                <span style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
                  {display(crumb.label)}
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* H1 */}
        <h1
          className="ivt-ph-h1 text-3xl sm:text-4xl md:text-6xl font-bold mb-6"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43', lineHeight: 1.15 }}
        >
          {display(title)}
        </h1>

        {/* Gold accent bar */}
        <div
          className="ivt-ph-bar mx-auto mb-6"
          style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
        />

        {subtitle && (
          <p
            className="ivt-ph-sub text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
          >
            {display(subtitle)}
          </p>
        )}

        {heroImage && !heroImgError && (
          <div
            className="ivt-ph-img mt-10 mx-auto overflow-hidden rounded-2xl shadow-lg"
            style={{
              maxWidth: '720px',
              aspectRatio: '16/9',
              position: 'relative',
              // This image is the mobile LCP candidate on service pages.
              // Keep it paintable while the rest of the stylesheet loads.
              animation: 'none',
              opacity: 1,
              transform: 'none',
            }}
          >
            <Image
              src={heroImage}
              alt={display(heroImageAlt ?? title)}
              fill
              className="object-cover"
              quality={60}
              sizes="(max-width: 768px) calc(100vw - 2.5rem), 720px"
              priority
              fetchPriority="high"
              onError={() => setHeroImgError(true)}
            />
          </div>
        )}
      </div>

      {/* Bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: '#D9E2EC' }}
        aria-hidden="true"
      />
    </section>
  );
}
