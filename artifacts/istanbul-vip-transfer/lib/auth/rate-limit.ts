/**
 * In-memory sliding-window rate limiter.
 * Portable — no Redis or external dependency required.
 * Used to limit login attempts: max 5 attempts per 15 minutes per IP.
 */

interface Entry {
  attempts: number;
  resetAt: number; // Unix timestamp ms
}

const store = new Map<string, Entry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // clean every 30 min

// Lazy cleanup to avoid memory leaks
let cleanupHandle: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupHandle) return;
  cleanupHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent Node.js process from exiting cleanly
  cleanupHandle.unref?.();
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and increment the rate limit counter for an identifier (e.g. IP address).
 */
export function rateLimit(identifier: string): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || existing.resetAt < now) {
    // New window
    store.set(identifier, { attempts: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: MAX_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }

  existing.attempts += 1;

  if (existing.attempts > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { success: false, remaining: 0, retryAfterSeconds };
  }

  return {
    success: true,
    remaining: MAX_ATTEMPTS - existing.attempts,
    retryAfterSeconds: 0,
  };
}

/** Clear the rate limit record for an identifier (call after successful login). */
export function clearRateLimit(identifier: string): void {
  store.delete(identifier);
}
