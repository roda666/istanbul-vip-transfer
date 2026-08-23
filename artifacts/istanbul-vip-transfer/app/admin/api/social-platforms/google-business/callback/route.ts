import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, socialPlatforms } from '@/db/schema';
import { encrypt, isEncryptionReady } from '@/lib/email-crypto';
import { ensureSocialPlatforms } from '@/lib/social-platforms';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { socialOAuthCallbackResponse } from '@/lib/social-oauth-callback';
import { getSocialSettingsUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

function callbackError(req: NextRequest, value: string) {
  return socialOAuthCallbackResponse(
    req,
    { provider: 'google_business', success: false, error: value },
    getSocialSettingsUrl(req, { social_error: value }),
  );
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return callbackError(req, response.status === 403 ? 'unauthorized' : 'unauthorized');
  }

  const url = new URL(req.url);
  const providerError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = req.cookies.get('google_business_oauth_state')?.value;
  const redirectUri = req.cookies.get('google_business_redirect_uri')?.value;

  if (providerError) return callbackError(req, 'google_business_consent_denied');
  if (!code || !storedState || state !== storedState || !redirectUri) return callbackError(req, 'google_business_invalid_state');
  if (!isEncryptionReady()) return callbackError(req, 'encryption_key_missing');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return callbackError(req, 'google_business_credentials_missing');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const token = await tokenResponse.json().catch(() => null) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    } | null;
    if (!tokenResponse.ok || !token?.access_token || !token.refresh_token) {
      return callbackError(req, 'google_business_token_exchange_failed');
    }

    const accessTokenEncrypted = encrypt(token.access_token);
    const refreshTokenEncrypted = encrypt(token.refresh_token);
    if (!accessTokenEncrypted || !refreshTokenEncrypted) return callbackError(req, 'encryption_key_missing');

    await ensureSocialPlatforms();
    const now = new Date();
    await db.update(socialPlatforms).set({
      connected: true,
      enabled: false,
      accessTokenEncrypted,
      accessTokenSecretEncrypted: refreshTokenEncrypted,
      tokenExpiresAt: new Date(now.getTime() + Math.max(60, token.expires_in ?? 3_600) * 1_000),
      connectionMeta: {
        scopes: (token.scope ?? '').split(' ').filter(Boolean),
      },
      lastError: null,
      connectedAt: now,
      updatedAt: now,
    }).where(eq(socialPlatforms.key, 'google_business'));
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'GOOGLE_BUSINESS_CONNECTED',
      entityType: 'social_platform',
      entityId: 'google_business',
      metadata: { hasRefreshToken: true },
    });

    const response = socialOAuthCallbackResponse(
      req,
      { provider: 'google_business', success: true, message: 'Google Business Profile bağlandı. Şimdi hesap ve konum seçin.' },
      getSocialSettingsUrl(req, { social_success: 'google_business_connected' }),
    );
    response.cookies.delete('google_business_oauth_state');
    response.cookies.delete('google_business_redirect_uri');
    return response;
  } catch {
    return callbackError(req, 'google_business_connection_failed');
  }
}