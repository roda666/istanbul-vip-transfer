import 'server-only';

import type { FormGuardForm } from '@/lib/form-guard';
import { decryptTurnstileSecret } from '@/lib/turnstile-settings-crypto';

export type TurnstileVerification =
  | { status: 'disabled' }
  | { status: 'verified' }
  | { status: 'rejected'; errorCodes?: string[]; configurationError?: boolean }
  | { status: 'unavailable' }
  | { status: 'unconfigured' };

type ActiveTurnstileConfig = {
  contactEnabled: boolean;
  reservationEnabled: boolean;
  siteKey: string | null;
  secret: string | null;
};

async function getActiveConfig(): Promise<ActiveTurnstileConfig> {
  try {
    const { db } = await import('@/db');
    const { turnstileSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(turnstileSettings)
      .where(eq(turnstileSettings.id, 1))
      .limit(1);

    if (!row) {
      return { contactEnabled: true, reservationEnabled: false, siteKey: null, secret: null };
    }
    const siteKey = row.siteKey?.trim() || null;
    const secret = row.secretKeyEncrypted
      ? await decryptTurnstileSecret(row.secretKeyEncrypted)
      : null;
    return {
      contactEnabled: row.contactEnabled,
      reservationEnabled: row.reservationEnabled,
      siteKey,
      secret: secret?.trim() || null,
    };
  } catch {
    // A settings read failure must not silently disable an explicitly configured
    // security layer; callers treat this as temporarily unavailable.
    throw new Error('Turnstile settings unavailable');
  }
}

export async function getPublicTurnstileConfig(form: FormGuardForm): Promise<{
  enabled: boolean;
  configured: boolean;
  siteKey?: string;
}> {
  try {
    const config = await getActiveConfig();
    const enabled = form === 'contact' ? config.contactEnabled : config.reservationEnabled;
    if (!enabled) return { enabled: false, configured: false };
    if (!config.siteKey || !config.secret) return { enabled: true, configured: false };
    return { enabled: true, configured: true, siteKey: config.siteKey };
  } catch {
    return { enabled: true, configured: false };
  }
}

export async function verifyTurnstileToken(
  token: unknown,
  form: FormGuardForm,
): Promise<TurnstileVerification> {
  let config: ActiveTurnstileConfig;
  try {
    config = await getActiveConfig();
  } catch {
    return { status: 'unavailable' };
  }

  const enabled = form === 'contact' ? config.contactEnabled : config.reservationEnabled;
  if (!enabled) return { status: 'disabled' };
  if (!config.siteKey || !config.secret) return { status: 'unconfigured' };
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return { status: 'rejected' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: config.secret, response: token }),
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return { status: 'unavailable' };

    const result = await response.json() as {
      success?: unknown;
      action?: unknown;
      'error-codes'?: unknown;
    };
    if (result.success === true && (typeof result.action !== 'string' || result.action === `ivt_${form}`)) {
      return { status: 'verified' };
    }

    const errors = Array.isArray(result['error-codes'])
      ? result['error-codes'].filter((value): value is string => typeof value === 'string')
      : [];
    if (errors.includes('invalid-input-secret')) return { status: 'unconfigured' };
    const configurationError = errors.includes('hostname-mismatch');
    const reason = typeof result.action === 'string' && result.action !== `ivt_${form}`
      ? `action-mismatch:${result.action}`
      : undefined;
    console.warn(
      '[turnstile] Verification rejected:',
      errors.length > 0 ? errors.join(', ') : reason ?? 'no-error-code',
    );
    return { status: 'rejected', errorCodes: errors, configurationError };
  } catch {
    return { status: 'unavailable' };
  }
}