/**
 * POST /data/vitals — Core Web Vitals collection endpoint.
 *
 * Receives metrics from WebVitalsReporter (client component) and logs them
 * to the server console. No external service or API key required.
 *
 * Payload: { name: string; value: number; rating: string; url: string }
 * rating: "good" | "needs-improvement" | "poor"  (web-vitals thresholds)
 *
 * Note: This route lives at /data/vitals (not /api/vitals) because /api is
 * served by the separate api-server artifact in this workspace routing setup.
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

    const icon = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '🔴';
    const display = name === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`;
    console.log(`[CWV] ${icon} ${name.padEnd(4)} ${display.padStart(10)}  ${rating}  ${url}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
