'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { localizedTransferRoutePath } from '@/lib/localized-service-path';
import type { TransferRouteCard } from '@/lib/transfer-route-pages';

/**
 * A compact discovery section built from the same published route records as
 * the route carousel. This keeps region links real (and locale-aware) rather
 * than maintaining a second, inevitably stale list of URLs.
 */
export default function PopularRegionsSection({ routes }: { routes: TransferRouteCard[] }) {
  const { lang } = useLang();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const regions = routes
    .filter((route) => lang === 'tr' || route.publishedPageLocales.includes(lang))
    .map((route) => ({
      key: route.id,
      label: lang === 'tr' ? route.destination : route.nameTranslations?.[lang],
      href: localizedTransferRoutePath(route.slug, lang),
    }))
    .filter((region): region is { key: string; label: string; href: string } => Boolean(region.label))
    .slice(0, 6);

  if (!hydrated || regions.length === 0) return null;
  const copy: Record<string, { eyebrow: string; heading: string; link: string }> = {
    tr: { eyebrow: 'Popüler bölgeler', heading: 'İstanbul ve çevresinde VIP transfer', link: 'Bölgeyi keşfet' },
    en: { eyebrow: 'Popular regions', heading: 'VIP transfers across Istanbul and beyond', link: 'Explore region' },
    de: { eyebrow: 'Beliebte Regionen', heading: 'VIP-Transfers in Istanbul und Umgebung', link: 'Region entdecken' },
    ru: { eyebrow: 'Популярные направления', heading: 'VIP-трансферы по Стамбулу и окрестностям', link: 'Подробнее' },
    ar: { eyebrow: 'المناطق الشائعة', heading: 'نقل VIP في إسطنبول والمناطق المحيطة', link: 'اكتشف المنطقة' },
    es: { eyebrow: 'Regiones populares', heading: 'Traslados VIP por Estambul y alrededores', link: 'Descubrir región' },
    fr: { eyebrow: 'Régions populaires', heading: 'Transferts VIP à Istanbul et alentours', link: 'Découvrir la région' },
    it: { eyebrow: 'Zone popolari', heading: 'Trasferimenti VIP a Istanbul e dintorni', link: 'Scopri la zona' },
    nl: { eyebrow: 'Populaire regio’s', heading: 'VIP-transfers in Istanbul en omgeving', link: 'Regio ontdekken' },
  };
  const t = copy[lang] ?? copy.en;

  return (
    <section aria-labelledby="popular-regions-heading" style={{ background: '#F3F6FA', padding: '64px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <p style={{ color: '#C99A32', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          {t.eyebrow}
        </p>
        <h2 id="popular-regions-heading" style={{ color: '#102A43', fontSize: 'clamp(24px, 4vw, 34px)', margin: '0 0 28px' }}>
          {t.heading}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {regions.map((region) => (
            <a key={region.key} href={region.href} style={{ background: '#fff', border: '1px solid #D9E2EC', borderRadius: 12, padding: '18px 16px', color: '#102A43', textDecoration: 'none', fontWeight: 700 }}>
              <span style={{ display: 'block', marginBottom: 10 }}>{region.label}</span>
              <span style={{ color: '#C99A32', fontSize: 12, fontWeight: 600 }}>{t.link} →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}