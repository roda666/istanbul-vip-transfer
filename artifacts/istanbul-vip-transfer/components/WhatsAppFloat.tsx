'use client';

/**
 * WhatsApp floating action button.
 *
 * Visibility rules (all three must be true to show):
 *  1. The initial 1.5 s entrance delay has elapsed (matches the old spring delay).
 *  2. The booking form section (#rezervasyon) is NOT intersecting the viewport.
 *
 * Implementation notes:
 *  - Uses a plain <a> element instead of framer-motion so that React state can
 *    unconditionally own opacity / visibility without being overridden by FM's
 *    own animated-value cache (the previous source of the "opacity stuck at 1" bug).
 *  - CSS keyframes (globals.css: .ivt-wa-pulse-1 / .ivt-wa-pulse-2) replace the
 *    FM-animated pulse rings.
 *  - When hidden: visibility:hidden + opacity:0 + pointer-events:none + tabIndex=-1
 *    + aria-hidden=true → completely invisible, untappable, and removed from the
 *    accessibility tree.
 *  - iOS safe-area: bottom/right use env(safe-area-inset-*) so the button sits
 *    above the home bar on notched iPhones.
 */

import { useState, useEffect } from 'react';
import { SITE } from '@/lib/site-config';
import { useLang } from '@/lib/i18n/context';

export default function WhatsAppFloat() {
  const { dict } = useLang();

  // True after the initial entrance delay has elapsed.
  const [appeared, setAppeared] = useState(false);

  // True while the #rezervasyon section is intersecting the viewport.
  const [formVisible, setFormVisible] = useState(false);

  // Initial entrance delay — mirrors the previous 1.5 s spring delay.
  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Hide while the booking form section is on screen.
  useEffect(() => {
    const section = document.getElementById('rezervasyon');
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormVisible(entry.isIntersecting),
      { threshold: 0.03 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // The button is visible only when it has appeared AND the form is off-screen.
  const show = appeared && !formVisible;

  return (
    <a
      href={SITE.whatsappFloatUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={dict.common.whatsappAria}
      aria-hidden={show ? undefined : true}
      tabIndex={show ? undefined : -1}
      data-testid="whatsapp-float"
      className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full"
      style={{
        background:    '#25D366',
        boxShadow:     '0 4px 20px rgba(37,211,102,0.4)',
        /* iOS notch / home-bar safe area */
        bottom:        'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        right:         'calc(1.25rem + env(safe-area-inset-right, 0px))',
        touchAction:   'manipulation',
        /* Visibility — React owns all three properties, no FM conflict */
        opacity:       show ? 1 : 0,
        visibility:    show ? 'visible' : 'hidden',
        pointerEvents: show ? 'auto' : 'none',
        /* Entrance/exit animation via CSS transition (not FM) */
        transform:     show ? 'scale(1) translateY(0)' : 'scale(0) translateY(12px)',
        transition:    show
          ? 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1), visibility 0s'
          : 'opacity 0.2s ease, transform 0.2s ease, visibility 0s 0.2s',
      }}
    >
      {/* Pulse ring 1 — animated via CSS keyframes in globals.css */}
      <span
        className="absolute inset-0 rounded-full ivt-wa-pulse-1"
        style={{ background: 'rgba(37,211,102,0.35)' }}
        aria-hidden="true"
      />
      {/* Pulse ring 2 — offset by 0.4 s */}
      <span
        className="absolute inset-0 rounded-full ivt-wa-pulse-2"
        style={{ background: 'rgba(37,211,102,0.2)' }}
        aria-hidden="true"
      />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    </a>
  );
}
