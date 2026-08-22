'use client';

/**
 * Privacy-friendly Core Web Vitals reporter.
 *
 * - Runs entirely in the browser; no external service or API key required.
 * - Uses the `web-vitals` package (already a dependency) to observe
 *   CLS, INP, LCP, FCP and TTFB after the page has become interactive.
 * - Sends each metric to the internal /data/vitals endpoint via sendBeacon
 *   (fire-and-forget — never blocks rendering).
 * - Falls back silently when web-vitals is unavailable (e.g. unsupported browser).
 */

import { useEffect } from 'react';

interface VitalsPayload {
  name:   string;
  value:  number;
  rating: string;
  url:    string;
}

export default function WebVitalsReporter() {
  useEffect(() => {
    let cancelled = false;
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

    if (typeof browserWindow.requestIdleCallback === 'function') {
      const idleId = browserWindow.requestIdleCallback(startReporter, { timeout: 3500 });
      return () => {
        cancelled = true;
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timer = window.setTimeout(startReporter, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
