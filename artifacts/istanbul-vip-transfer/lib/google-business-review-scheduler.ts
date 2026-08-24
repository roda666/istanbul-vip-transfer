import 'server-only';

import { syncGoogleBusinessReviews } from '@/lib/google-business';

const REVIEW_SYNC_INTERVAL_MS = 60 * 60 * 1_000;
const STARTUP_DELAY_MS = 60_000;
let started = false;

async function runReviewSync(): Promise<void> {
  try {
    const result = await syncGoogleBusinessReviews({ requireEnabled: true, source: 'scheduled' });
    console.info(`[google-reviews] Sync complete — received ${result.received}, updated ${result.upserted}.`);
  } catch {
    // A missing OAuth connection, disabled channel, or a transient provider
    // problem must not affect application startup or expose provider details.
    console.info('[google-reviews] Sync skipped — no ready Google Business connection.');
  }
}

/**
 * Keeps the public Google review cache fresh while this Node.js service is up.
 * Safe to invoke more than once from Next instrumentation.
 */
export function startGoogleBusinessReviewScheduler(): void {
  if (started) return;
  started = true;

  console.info('[google-reviews] Scheduler starting — hourly sync.');
  setTimeout(() => void runReviewSync(), STARTUP_DELAY_MS);
  setInterval(() => void runReviewSync(), REVIEW_SYNC_INTERVAL_MS);
}