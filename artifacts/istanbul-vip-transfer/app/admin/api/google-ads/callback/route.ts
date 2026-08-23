/**
 * GET /admin/api/google-ads/callback
 * Handles the Google OAuth2 callback for Google Ads API (Keyword Planner).
 * Exchanges the code for tokens and stores them in google_ads_connections.
 *
 * The callback URI is provided by the short-lived OAuth cookie created by
 * /admin/api/google-ads/connect, allowing preview and production hosts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { classifyGoogleOAuthProviderError } from '@/lib/google-oauth-feedback';
import { getPublicUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

type GoogleAdsTokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
};

function isFreshGoogleAdsState(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return false;
    const state = parsed as { ts?: unknown; svc?: unknown; nonce?: unknown };
    return state.svc === 'google_ads'
      && typeof state.ts === 'number'
      && Number.isSafeInteger(state.ts)
      && state.ts <= Date.now() + 60_000
      && Date.now() - state.ts <= OAUTH_STATE_MAX_AGE_MS
      && typeof state.nonce === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(state.nonce);
  } catch {
    return false;
  }
}

function isValidGoogleAdsTokenPayload(value: unknown): value is GoogleAdsTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const token = value as Record<string, unknown>;
  return typeof token.access_token === 'string' && token.access_token.length > 0 && token.access_token.length <= 8_192
    && typeof token.refresh_token === 'string' && token.refresh_token.length > 0 && token.refresh_token.length <= 8_192
    && typeof token.expires_in === 'number' && Number.isFinite(token.expires_in)
    && token.expires_in > 0 && token.expires_in <= MAX_TOKEN_EXPIRY_SECONDS
    && typeof token.scope === 'string' && token.scope.split(/\s+/).includes('https://www.googleapis.com/auth/adwords');
}

async function persistGoogleAdsConnectionError(error: string) {
  try {
    const { db } = await import('@/db');
    const { googleAdsConnections } = await import('@/db/schema');
    await db.update(googleAdsConnections).set({ lastError: error, updatedAt: new Date() });
  } catch {
    // The redirect must still succeed if the connection table is unavailable.
  }
}

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const url      = new URL(req.url);
  const code     = url.searchParams.get('code');
  const state    = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  const settingsBase = '/admin/ayarlar/icerik-entegrasyonlari';
  const errorRedirect = (err: string) => {
    const response = NextResponse.redirect(new URL(`${settingsBase}?error=gads_${err}`, req.url));
    response.cookies.delete('gads_oauth_state');
    response.cookies.delete('gads_redirect_uri');
    return response;
  };

  if (errParam) return errorRedirect(classifyGoogleOAuthProviderError(errParam));

  // CSRF check
  const storedState = req.cookies.get('gads_oauth_state')?.value;
  if (!storedState || storedState !== state || !isFreshGoogleAdsState(storedState)) {
    return errorRedirect('invalid_state');
  }

  const redirectUri = req.cookies.get('gads_redirect_uri')?.value;
  const expectedRedirectUri = getPublicUrl(req, '/admin/api/google-ads/callback');
  if (!code || code.length > 8_192 || redirectUri !== expectedRedirectUri) {
    return errorRedirect('missing_code');
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return errorRedirect('missing_credentials');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  expectedRedirectUri,
        grant_type:    'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      console.error('[Ads callback] Token exchange failed:', tokenRes.status);
      await persistGoogleAdsConnectionError('token_exchange_failed');
      return errorRedirect('token_exchange_failed');
    }

    const tokens: unknown = await tokenRes.json();
    if (!isValidGoogleAdsTokenPayload(tokens)) {
      await persistGoogleAdsConnectionError('invalid_token_response');
      return errorRedirect('invalid_token_response');
    }

    // Get user email (non-fatal)
    let email: string | null = null;
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal:  AbortSignal.timeout(5_000),
      });
      if (uRes.ok) email = ((await uRes.json()) as { email?: string }).email ?? null;
    } catch { /* non-fatal */ }

    const expiry = new Date(Date.now() + tokens.expires_in * 1_000);

    // Upsert — single-row pattern
    const { db } = await import('@/db');
    const { googleAdsConnections } = await import('@/db/schema');
    await db.delete(googleAdsConnections);
    await db.insert(googleAdsConnections).values({
      accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      connected: true, enabled: true, lastError: null, tokenExpiry: expiry,
      scope: tokens.scope, connectedEmail: email,
    });

    const successUrl = new URL(`${settingsBase}?success=gads_connected`, req.url);
    const response   = NextResponse.redirect(successUrl);
    response.cookies.delete('gads_oauth_state');
    response.cookies.delete('gads_redirect_uri');
    return response;
  } catch {
    console.error('[Ads callback] server_error');
    await persistGoogleAdsConnectionError('server_error');
    return errorRedirect('server_error');
  }
}
