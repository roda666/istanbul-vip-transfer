'use client';
/**
 * HizmetlerCategoryNav — sticky tab navigation for the /hizmetler service list.
 * Smooth-scrolls to each category section anchor. Highlights the active tab
 * based on scroll position. Localised labels for all 9 supported locales.
 */
import { useState, useEffect } from 'react';

const CATEGORIES = ['airport', 'city_vip', 'intercity', 'tour', 'special'] as const;

const CAT_LABELS: Record<string, Record<string, string>> = {
  airport:  { tr: 'Havalimanı', en: 'Airport', de: 'Flughafen', ru: 'Аэропорт', ar: 'مطار', fr: 'Aéroport', es: 'Aeropuerto', it: 'Aeroporto', nl: 'Luchthaven' },
  city_vip: { tr: 'VIP & Şehir İçi', en: 'VIP & City', de: 'VIP & Stadt', ru: 'VIP & Город', ar: 'VIP والمدينة', fr: 'VIP & Ville', es: 'VIP & Ciudad', it: 'VIP & Città', nl: 'VIP & Stad' },
  intercity:{ tr: 'Şehirlerarası', en: 'Intercity', de: 'Intercity', ru: 'Межгород', ar: 'بين المدن', fr: 'Interurbain', es: 'Interurbano', it: 'Intercity', nl: 'Intercity' },
  tour:     { tr: 'Günübirlik Turlar', en: 'Day Tours', de: 'Tagestouren', ru: 'Экскурсии', ar: 'جولات يومية', fr: 'Excursions', es: 'Excursiones', it: 'Tour', nl: 'Dagtochten' },
  special:  { tr: 'Özel Hizmetler', en: 'Special', de: 'Speziell', ru: 'Особые', ar: 'خاص', fr: 'Spécial', es: 'Especial', it: 'Speciale', nl: 'Speciaal' },
};

interface Props { locale: string }

export default function HizmetlerCategoryNav({ locale }: Props) {
  const [active, setActive] = useState<string>('airport');

  // Track which section is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    CATEGORIES.forEach(cat => {
      const el = document.getElementById(`hiz-cat-${cat}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(cat); },
        { rootMargin: '-40% 0px -50% 0px' },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  function scrollTo(cat: string) {
    const el = document.getElementById(`hiz-cat-${cat}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
    setActive(cat);
  }

  const GOLD = '#C9A84C';
  const isRtl = locale === 'ar';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '32px',
        padding: '6px',
        background: 'rgba(201,168,76,0.04)',
        borderRadius: '12px',
        border: '1px solid rgba(201,168,76,0.12)',
      }}
    >
      {CATEGORIES.map(cat => {
        const isActive = active === cat;
        const label = CAT_LABELS[cat]?.[locale] ?? CAT_LABELS[cat]?.['en'] ?? cat;
        return (
          <button
            key={cat}
            onClick={() => scrollTo(cat)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: isActive ? `1px solid ${GOLD}` : '1px solid transparent',
              background: isActive ? GOLD : 'transparent',
              color: isActive ? '#102A43' : '#50677A',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              letterSpacing: isActive ? '0.02em' : undefined,
            }}
            aria-current={isActive ? 'true' : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
