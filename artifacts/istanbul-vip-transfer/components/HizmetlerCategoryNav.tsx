'use client';
/**
 * HizmetlerCategoryNav — sticky tab navigation for the /hizmetler service list.
 * Smooth-scrolls to each category section anchor. Highlights the active tab
 * based on scroll position.
 *
 * Category list is now DB-driven: passed as a prop from the parent server
 * page (which calls getServiceCategories). No hard-coded labels or slugs.
 */
import { useState, useEffect } from 'react';
import type { ServiceCategoryItem } from '@/lib/service-category-server';

interface Props {
  locale:     string;
  categories: ServiceCategoryItem[];
}

export default function HizmetlerCategoryNav({ locale, categories }: Props) {
  const [active, setActive] = useState<string>(categories[0]?.slug ?? '');
  const isRtl = locale === 'ar';

  // Track which section is in view
  useEffect(() => {
    if (categories.length === 0) return;
    const observers: IntersectionObserver[] = [];
    categories.forEach(cat => {
      const el = document.getElementById(`hiz-cat-${cat.slug}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(cat.slug); },
        { rootMargin: '-40% 0px -50% 0px' },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [categories]);

  function scrollTo(slug: string) {
    const el = document.getElementById(`hiz-cat-${slug}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
    setActive(slug);
  }

  const GOLD = '#C9A84C';

  if (categories.length === 0) return null;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px',
        padding: '6px',
        background: 'rgba(201,168,76,0.04)',
        borderRadius: '12px',
        border: '1px solid rgba(201,168,76,0.12)',
      }}
    >
      {categories.map(cat => {
        const isActive = active === cat.slug;
        return (
          <button
            key={cat.slug}
            onClick={() => scrollTo(cat.slug)}
            style={{
              padding: '8px 18px', borderRadius: '8px',
              border: isActive ? `1px solid ${GOLD}` : '1px solid transparent',
              background: isActive ? GOLD : 'transparent',
              color: isActive ? '#102A43' : '#50677A',
              fontFamily: 'Inter, sans-serif', fontSize: '13px',
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              letterSpacing: isActive ? '0.02em' : undefined,
            }}
            aria-current={isActive ? 'true' : undefined}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
