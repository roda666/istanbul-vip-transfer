/**
 * Google Analytics 4 — thin event utility.
 *
 * The gtag script is loaded via next/script in app/layout.tsx.
 * This module provides the type declaration and a safe `trackEvent` wrapper
 * so any client component can fire GA4 events without importing gtag directly.
 */

// GA4 Measurement ID
export const GA_ID = 'G-SHCE3X1ZY0';

// Extend the browser Window interface for gtag
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[];
  }
}

/**
 * Fire a GA4 custom event.
 *
 * Safe to call during SSR (no-ops when window is undefined)
 * and before gtag has initialised (no-ops when gtag is not a function).
 *
 * @param eventName  GA4 event name, e.g. 'whatsapp_click'
 * @param params     Optional event parameters sent alongside the event
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params ?? {});
}
