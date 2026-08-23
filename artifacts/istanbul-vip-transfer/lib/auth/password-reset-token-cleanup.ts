import 'server-only';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60_000;

let cleanupStarted = false;

export async function deleteExpiredPasswordResetTokens(): Promise<void> {
  const { db } = await import('@/db');
  await db.execute(
    'DELETE FROM password_reset_tokens WHERE expires_at < NOW()' as never,
  );
}

async function runCleanup(): Promise<void> {
  try {
    await deleteExpiredPasswordResetTokens();
  } catch {
    // Reset requests remain available if the database is temporarily unavailable.
    // Do not expose database details through a background process log.
    console.error('[password-reset-cleanup] Unable to remove expired reset tokens.');
  }
}

/**
 * Starts the periodic removal of expired reset tokens. Safe to call multiple
 * times in a process and deliberately does not block server startup.
 */
export function startPasswordResetTokenCleanup(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const initialRun = setTimeout(() => void runCleanup(), INITIAL_DELAY_MS);
  initialRun.unref?.();

  const interval = setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
  interval.unref?.();
}