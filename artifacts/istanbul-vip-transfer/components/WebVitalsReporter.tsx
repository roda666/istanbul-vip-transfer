'use client';

/**
 * Privacy-friendly Core Web Vitals reporter.
 *
 * - Starts only after analytics cookies are accepted.
 * - Uses the `web-vitals` package (already a dependency) to observe
 *   CLS, INP, LCP, FCP and TTFB after the page has become interactive.
 * - Sends each metric to the internal /data/vitals endpoint via sendBeacon
 *   (fire-and-forget — never blocks rendering).
 * - Falls back silently when web-vitals is unavailable (e.g. unsupported browser).
 */

import { useEffect } from 'react';

const CONSENT_COOKIE = 'ivt_cookie_consent';
const ACCEPTED_CONSENT = 'accepted';

interface VitalsPayload {
  name:   string;
  value:  number;
  rating: string;
  url:    string;
}

function hasAnalyticsConsent(): boolean {
  return document.cookie
    .split('; ')
    .some((value) => value === `${CONSENT_COOKIE}=${ACCEPTED_CONSENT}`);
}

export default function WebVitalsReporter() {
  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timer: number | undefined;
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const startReporter = () => import('web-vitals')
      .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
        if (cancelled) return;
        const report = ({ name, value, rating }: { name: string; value: number; rating: string }) => {
          const payload: VitalsPayload = {
            name,
            value,
            rating,
            url: window.location.pathname,
          };
          if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon('/data/vitals', JSON.stringify(payload));
          }
        };

        onCLS(report);
        onINP(report);
        onLCP(report);
        onFCP(report);
        onTTFB(report);
      })
      .catch(() => {
        // web-vitals not available in this browser — silent no-op
      });

    const scheduleReporter = () => {
      if (cancelled) return;
      if (typeof browserWindow.requestIdleCallback === 'function') {
        idleId = browserWindow.requestIdleCallback(startReporter, { timeout: 3500 });
        return;
      }
      timer = window.setTimeout(startReporter, 2500);
    };

    const onConsentAccepted = () => scheduleReporter();
    if (hasAnalyticsConsent()) {
      scheduleReporter();
    } else {
      window.addEventListener('ivt:consent:accepted', onConsentAccepted, { once: true });
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) browserWindow.cancelIdleCallback?.(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('ivt:consent:accepted', onConsentAccepted);
    };
  }, []);

  return null;
}
