'use client';

import Image from 'next/image';
import { useLang } from '@/lib/i18n/context';
import type { TransferRoute } from '@/db/schema';
import { useEffect, useState } from 'react';
import { localizedServicePath } from '@/lib/localized-service-path';

// ── Design tokens (matches site dark/gold aesthetic) ──────────────────────────
const DARK_BG    = '#0C1B2A';
const CARD_BG    = '#132A44';
const GOLD       = '#C99A32';
const GOLD_LIGHT = '#E8B84B';
const TEXT_MAIN  = '#FFFFFF';
const TEXT_MUTED = 'rgba(255,255,255,0.65)';
const BORDER     = 'rgba(201,154,50,0.20)';

function formatDuration(minutes: number, min: string, h: string) {
  if (minutes < 60) return `${minutes} ${min}`;
  const hours = Math.floor(minutes / 60);
  const m     = minutes % 60;
  return m > 0 ? `${hours} ${h} ${m} ${min}` : `${hours} ${h}`;
}

/** Never display a Turkish source route name on a non-Turkish public page. */
function localize(base: string, translations: Record<string, string> | null | undefined, lang: string): string | null {
  if (lang === 'tr') return base;
  return translations?.[lang] ?? null;
}

/**
 * Map a route name to the most relevant service page slug.
 * Runs purely on keywords found in the route name.
 */
function getRouteHref(routeName: string, lang: string): string {
  const n = routeName.toLowerCase();
  let slug = '';
  if (n.includes('sabiha')) {
    slug = 'sabiha-gokcen-havalimani-transfer';
  } else if (n.includes('havalimanı') || n.includes('havalimani') || n.includes('airport')) {
    slug = 'istanbul-havalimani-transfer';
  } else if (n.includes('antalya')) {
    slug = 'antalya-vip-transfer';
  } else if (n.includes('ankara')) {
    slug = 'ankara-vip-transfer';
  } else if (n.includes('izmir') || n.includes('İzmir')) {
    slug = 'izmir-vip-transfer';
  } else if (n.includes('bursa')) {
    slug = 'istanbul-bursa-transfer';
  } else if (n.includes('bodrum') || n.includes('şehirlerarası') || n.includes('intercity')) {
    slug = 'sehirler-arasi-transfer';
  } else if (n.includes('otel') || n.includes('boğaz') || n.includes('hotel')) {
    slug = 'otel-transfer';
  } else {
    slug = 'vip-transfer';
  }
  return localizedServicePath(slug, lang);
}

function RouteCard({ route, lang, t }: {
  route: TransferRoute;
  lang: string;
  t: { vito: string; sprinter: string; min: string; h: string; km: string };
}) {
  const name = localize(route.name, route.nameTranslations, lang);
  if (!name) return null;
  const vitoRange     = `${route.priceVitoMinEur}–${route.priceVitoMaxEur} €`;
  const sprinterRange = `${route.priceSprinterMinEur}–${route.priceSprinterMaxEur} €`;
  const href = getRouteHref(route.name, lang);

  return (
    <a
      href={href}
      title={`${name} — İstanbul VIP Transfer`}
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(201,154,50,0.18)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: '180px', background: '#0C1B2A', flexShrink: 0 }}>
        {route.imagePath ? (
          <Image
            src={route.imagePath}
            alt={name}
            fill
            sizes="(max-width:600px) 100vw, (max-width:900px) 50vw, 340px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>🚘</div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,27,42,0.7) 0%, transparent 60%)' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {/* Route name */}
        <h3 style={{ margin: 0, color: TEXT_MAIN, fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
          {name}
        </h3>

        {/* Distance + Duration */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ color: TEXT_MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            📍 {route.distanceKm} {t.km}
          </span>
          <span style={{ color: TEXT_MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            ⏱ {formatDuration(route.durationMinutes, t.min, t.h)}
          </span>
        </div>

        {/* Price rows */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: TEXT_MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
              Mercedes {t.vito}
            </span>
            <span style={{ color: GOLD_LIGHT, fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {vitoRange}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: TEXT_MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
              Mercedes {t.sprinter}
            </span>
            <span style={{ color: GOLD_LIGHT, fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {sprinterRange}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function PopularRoutesSection({ routes }: { routes: TransferRoute[] }) {
  const { dict, lang } = useLang();
  const t = dict.routes;
  const [hydrated, setHydrated] = useState(false);
  const visibleRoutes = routes.filter((route) => localize(route.name, route.nameTranslations, lang));

  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated || visibleRoutes.length === 0) return null;

  return (
    <section
      aria-labelledby="popular-routes-heading"
      style={{
        background: DARK_BG,
        padding: '80px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gold glow */}
      <div style={{ position: 'absolute', top: '30%', left: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(201,154,50,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <p style={{ color: GOLD, fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', margin: '0 0 12px' }}>
            {t.sectionLabel}
          </p>
          <h2
            id="popular-routes-heading"
            style={{ color: TEXT_MAIN, fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, fontFamily: 'Inter, sans-serif', margin: '0 0 14px', lineHeight: 1.2 }}
          >
            {t.heading}
          </h2>
          <p style={{ color: TEXT_MUTED, fontSize: '15px', fontFamily: 'Inter, sans-serif', margin: 0, maxWidth: '540px', marginInline: 'auto', lineHeight: 1.6 }}>
            {t.subheading}
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {visibleRoutes.map((route) => (
            <RouteCard key={route.id} route={route} lang={lang} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
