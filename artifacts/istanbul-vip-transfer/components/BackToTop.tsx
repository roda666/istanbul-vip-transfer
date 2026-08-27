'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

export default function BackToTop() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);
  const ariaLabel = ({
    tr: 'Yukarı çık',
    en: 'Back to top',
    de: 'Nach oben',
    ru: 'Наверх',
    ar: 'العودة إلى الأعلى',
    fr: 'Retour en haut',
    es: 'Volver arriba',
    it: 'Torna su',
    nl: 'Naar boven',
  } as Record<string, string>)[lang] ?? 'Back to top';

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 520);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  return (
    <button
      type="button"
      className="ivt-float-button ivt-back-to-top"
      aria-label={ariaLabel}
      data-testid="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        zIndex: 50,
        bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.42)',
        background: 'rgba(16,42,67,0.72)',
        color: '#FFFFFF',
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 18px rgba(16,42,67,0.25)',
        touchAction: 'manipulation',
        transform: 'translateX(-50%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <ArrowUp size={21} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}