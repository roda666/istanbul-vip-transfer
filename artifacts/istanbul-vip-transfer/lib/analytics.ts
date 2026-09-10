/**
 * Shared browser analytics event utility.
 *
 * Supports both the existing GA4 integration and Replit-hosted analytics.
 * Replit injects its tracker only after analytics is enabled and the site is
 * published, so both providers are optional and must remain safe no-ops.
 */

// GA4 Measurement ID
export const GA_ID = 'G-SHCE3X1ZY0';

// Extend the browser Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    umami?: {
      track(name: string, data?: Record<string, string | number | boolean>): void;
    };
  }
}

/**
 * Fire a custom event through every available analytics provider.
 *
 * Safe to call during SSR (no-ops when window is undefined)
 * and before either tracker has initialised.
 *
 * @param eventName  GA4 event name, e.g. 'whatsapp_click'
 * @param params     Optional event parameters sent alongside the event
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(eventName, params);
  } catch {
    // Analytics must never interrupt the visitor flow.
  }
  try {
    window.gtag?.('event', eventName, params ?? {});
  } catch {
    // Keep the second provider independent if the first one fails.
  }
}
