/**
 * DB-backed sliding-window rate limiter.
 *
 * Persists attempt counts in PostgreSQL so limits survive server restarts,
 * deploys, and crashes. Table is created automatically on first use.
 *
 * Used to limit login attempts: max 5 attempts per 15 minutes per identifier.
 */

import postgres from 'postgres';

const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// Lazy postgres connection — reuses DATABASE_URL like the rest of the app.
let _sql: ReturnType<typeof postgres> | null = null;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = postgres(url, { max: 2, idle_timeout: 30 });
  }
  return _sql;
}

// Ensure the table exists (idempotent — safe to call on every request).
let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limit_entries (
      key        TEXT PRIMARY KEY,
      attempts   INTEGER NOT NULL DEFAULT 1,
      reset_at   BIGINT  NOT NULL
    )
  `;
  _tableReady = true;
}

/**
 * Check and increment the rate limit counter for an identifier (e.g. IP address).
 * Returns whether the request is allowed and how many attempts remain.
 */
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  await ensureTable();
  const sql = getSql();
  const now  = BigInt(Date.now());
  const resetAt = now + BigInt(WINDOW_MS);

  // Upsert: if the key doesn't exist or the window has expired, start a fresh window.
  // Otherwise increment the attempt counter.
  const rows = await sql<{ attempts: number; reset_at: string }[]>`
    INSERT INTO rate_limit_entries (key, attempts, reset_at)
    VALUES (${identifier}, 1, ${resetAt.toString()})
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN rate_limit_entries.reset_at < ${now.toString()}
          THEN 1                                -- expired window → fresh start
        ELSE rate_limit_entries.attempts + 1    -- same window → increment
      END,
      reset_at = CASE
        WHEN rate_limit_entries.reset_at < ${now.toString()}
          THEN ${resetAt.toString()}            -- reset the window
        ELSE rate_limit_entries.reset_at        -- keep existing window
      END
    RETURNING attempts, reset_at
  `;

  const { attempts, reset_at } = rows[0];

  if (attempts > MAX_ATTEMPTS) {
    const retryAfterMs = Number(BigInt(reset_at) - now);
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return {
    success: true,
    remaining: MAX_ATTEMPTS - attempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Clear the rate limit record for an identifier (call after a successful login).
 */
export async function clearRateLimit(identifier: string): Promise<void> {
  await ensureTable();
  const sql = getSql();
  await sql`DELETE FROM rate_limit_entries WHERE key = ${identifier}`;
}
