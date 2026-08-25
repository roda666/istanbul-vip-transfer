import 'server-only';

export type BotProtectionForm = 'RESERVATION' | 'CONTACT';
export type BotProtectionReason =
  | 'RATE_LIMIT'
  | 'HONEYPOT'
  | 'FORM_TIMING'
  | 'TURNSTILE_REJECTED'
  | 'TURNSTILE_CONFIG_ERROR'
  | 'TURNSTILE_UNAVAILABLE'
  | 'TURNSTILE_UNCONFIGURED';

function currentHourBucket(): Date {
  const bucket = new Date();
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

/**
 * Count bot blocks as hourly aggregates. Intentionally stores no IP address,
 * form values, or browser details.
 */
export async function recordBotProtectionBlock(input: {
  formType: BotProtectionForm;
  reason: BotProtectionReason;
}): Promise<void> {
  try {
    const { db } = await import('@/db');
    const { botProtectionMetrics } = await import('@/db/schema');
    const { sql } = await import('drizzle-orm');

    await db.insert(botProtectionMetrics).values({
      formType: input.formType,
      reason: input.reason,
      bucketStart: currentHourBucket(),
      blockedCount: 1,
    }).onConflictDoUpdate({
      target: [
        botProtectionMetrics.formType,
        botProtectionMetrics.reason,
        botProtectionMetrics.bucketStart,
      ],
      set: {
        blockedCount: sql`${botProtectionMetrics.blockedCount} + 1`,
      },
    });
  } catch {
    // Enforcement must never fail open when dashboard metric persistence fails.
  }
}