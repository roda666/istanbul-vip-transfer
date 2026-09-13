import 'server-only';

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { syncGoogleBusinessReviews } from '@/lib/google-business';
import { revalidateAllHomepages } from '@/lib/homepage-revalidation';

const REVIEW_SYNC_INTERVAL_MS = 60 * 60 * 1_000;
const STARTUP_DELAY_MS = 60_000;
const LEASE_NAME = 'google-business-review-sync';
const LEASE_TTL_MS = 10 * 60 * 1_000;
let started = false;
let runInProgress = false;
type ReviewSyncRunOptions = {
  requireEnabled?: boolean;
  source?: 'scheduled' | 'manual';
};

function isMissingHealthLeaseTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (message.includes('relation') && message.includes('does not exist'))
    || (error as { code?: string }).code === '42P01';
}

/**
 * Run one safe, cross-instance hourly sync. The database lease is intentionally
 * shared with every scheduler invocation, while runInProgress prevents timer
 * overlap inside this Node process. A missing connection or unavailable lease
 * table is a quiet skip: startup and public pages must remain healthy.
 */
export async function runGoogleBusinessReviewSync(options: ReviewSyncRunOptions = {}): Promise<
  | { status: 'complete'; received: number; upserted: number; skipped: number }
  | { status: 'skipped_overlap' | 'skipped_not_ready' | 'skipped_missing_tables' | 'failed' }
> {
  if (runInProgress) return { status: 'skipped_overlap' };
  runInProgress = true;

  let leaseOwner: string | null = null;
  let leaseDb: typeof import('@/db')['db'] | null = null;
  let leaseSchema: typeof import('@/db/schema') | null = null;
  try {
    const [{ db }, schema] = await Promise.all([import('@/db'), import('@/db/schema')]);
    leaseDb = db;
    leaseSchema = schema;
    const ownerToken = randomUUID();
    const lease = await db.insert(schema.healthCheckLeases)
      .values({
        lockName: LEASE_NAME,
        ownerToken,
        expiresAt: new Date(Date.now() + LEASE_TTL_MS),
      })
      .onConflictDoUpdate({
        target: schema.healthCheckLeases.lockName,
        set: {
          ownerToken,
          expiresAt: new Date(Date.now() + LEASE_TTL_MS),
        },
        where: sql`${schema.healthCheckLeases.expiresAt} < now()`,
      })
      .returning({ ownerToken: schema.healthCheckLeases.ownerToken });

    if (lease[0]?.ownerToken !== ownerToken) return { status: 'skipped_overlap' };
    leaseOwner = ownerToken;

    try {
      const result = await syncGoogleBusinessReviews({
        requireEnabled: options.requireEnabled ?? true,
        source: options.source ?? 'scheduled',
      });
      // Cache invalidation is deliberately after the complete provider + DB
      // operation. A failed sync therefore leaves old verified rows visible.
      revalidateAllHomepages();
      console.info(`[google-reviews] Sync complete — received ${result.received}, updated ${result.upserted}.`);
      return { status: 'complete', received: result.received, upserted: result.upserted, skipped: result.skipped };
    } catch {
      // Do not expose provider responses, OAuth secrets, or raw stack traces.
      return { status: 'skipped_not_ready' };
    }
  } catch (error) {
    if (isMissingHealthLeaseTableError(error)) return { status: 'skipped_missing_tables' };
    return { status: 'failed' };
  } finally {
    if (leaseDb && leaseSchema && leaseOwner) {
      try {
        await leaseDb.delete(leaseSchema.healthCheckLeases).where(sql`
          ${leaseSchema.healthCheckLeases.lockName} = ${LEASE_NAME}
          AND ${leaseSchema.healthCheckLeases.ownerToken} = ${leaseOwner}
        `);
      } catch (error) {
        if (!isMissingHealthLeaseTableError(error)) {
          console.warn('[google-reviews] Lease release skipped.');
        }
      }
    }
    runInProgress = false;
  }
}

/**
 * Keeps the public Google review cache fresh while this Node.js service is up.
 * Safe to invoke more than once from Next instrumentation.
 */
export function startGoogleBusinessReviewScheduler(): void {
  if (started) return;
  started = true;
  setTimeout(() => void runGoogleBusinessReviewSync(), STARTUP_DELAY_MS);
  setInterval(() => void runGoogleBusinessReviewSync(), REVIEW_SYNC_INTERVAL_MS);
}
