/**
 * POST /api/vitals — Core Web Vitals collection endpoint.
 *
 * Receives metrics from WebVitalsReporter (client component) and logs them
 * to the server console.  No external service or API key required.
 *
 * Payload shape:
 *   { name: string; value: number; rating: string; url: string }
 *
 * Extend this handler later to persist to DB or forward to an analytics
 * service (e.g. Plausible, PostHog, custom table) without touching the client.
 *
 * rating: "good" | "needs-improvement" | "poor"  (web-vitals thresholds)
 *
 * Budget thresholds (web-vitals standard):
 *   LCP  ≤ 2500 ms = good,  ≤ 4000 ms = needs-improvement, > 4000 ms = poor
 *   CLS  ≤ 0.1        = good,  ≤ 0.25       = needs-improvement
 *   INP  ≤ 200 ms = good,  ≤ 500 ms = needs-improvement
 *   FCP  ≤ 1800 ms = good,  ≤ 3000 ms = needs-improvement
 *   TTFB ≤ 800 ms  = good,  ≤ 1800 ms = needs-improvement
 */
import { NextRequest, NextResponse } from 'next/server';

interface VitalsPayload {
  name:   string;
  value:  number;
  rating: string;
  url:    string;
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const metric = JSON.parse(text) as VitalsPayload;

    const { name, value, rating, url } = metric;

    if (typeof name !== 'string' || typeof value !== 'number') {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Colour-coded prefix for quick terminal scanning
    const icon = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '🔴';
    const display = name === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`;

    console.log(`[CWV] ${icon} ${name.padEnd(4)} ${display.padStart(10)}  ${rating}  ${url}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
