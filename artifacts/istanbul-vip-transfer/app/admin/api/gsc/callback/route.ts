/**
 * GET /admin/api/gsc/callback
 * Handles the Google OAuth2 callback for Search Console.
 * Exchanges the authorization code for tokens and stores them in the DB.
 *
 * The callback URI is provided by the short-lived OAuth cookie created by
 * /admin/api/gsc/connect, allowing preview and production hosts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { classifyGoogleOAuthProviderError } from '@/lib/google-oauth-feedback';
import { getPublicUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

type GoogleTokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
};

function isFreshGscState(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return false;
    const state = parsed as { ts?: unknown; nonce?: unknown };
    const timestamp = state.ts;
    return typeof timestamp === 'number'
      && Number.isSafeInteger(timestamp)
      && timestamp <= Date.now() + 60_000
      && Date.now() - timestamp <= OAUTH_STATE_MAX_AGE_MS
      && typeof state.nonce === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(state.nonce);
  } catch {
    return false;
  }
}

function isValidGscTokenPayload(value: unknown): value is GoogleTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const token = value as Record<string, unknown>;
  return typeof token.access_token === 'string' && token.access_token.length > 0 && token.access_token.length <= 8_192
    && typeof token.refresh_token === 'string' && token.refresh_token.length > 0 && token.refresh_token.length <= 8_192
    && typeof token.expires_in === 'number' && Number.isFinite(token.expires_in)
    && token.expires_in > 0 && token.expires_in <= MAX_TOKEN_EXPIRY_SECONDS
    && typeof token.scope === 'string' && token.scope.split(/\s+/).includes('https://www.googleapis.com/auth/webmasters.readonly');
}

async function persistGscConnectionError(error: string) {
  try {
    const { db } = await import('@/db');
    const { gscConnections } = await import('@/db/schema');
    await db.update(gscConnections).set({ lastError: error, updatedAt: new Date() });
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

  function errorRedirect(err: string) {
    const response = NextResponse.redirect(new URL(`${settingsBase}?error=${err}`, req.url));
    response.cookies.delete('gsc_oauth_state');
    response.cookies.delete('gsc_redirect_uri');
    return response;
  }

  if (errParam) return errorRedirect(classifyGoogleOAuthProviderError(errParam));

  // CSRF check
  const storedState = req.cookies.get('gsc_oauth_state')?.value;
  if (!storedState || storedState !== state || !isFreshGscState(storedState)) {
    return errorRedirect('invalid_state');
  }

  const redirectUri = req.cookies.get('gsc_redirect_uri')?.value;
  const expectedRedirectUri = getPublicUrl(req, '/admin/api/gsc/callback');
  if (!code || code.length > 8_192 || redirectUri !== expectedRedirectUri) {
    return errorRedirect('missing_code');
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return errorRedirect('missing_credentials');

  try {
    // Exchange code for tokens
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
      console.error('[GSC callback] Token exchange failed:', tokenRes.status);
      await persistGscConnectionError('token_exchange_failed');
      return errorRedirect('token_exchange_failed');
    }

    const tokens: unknown = await tokenRes.json();
    if (!isValidGscTokenPayload(tokens)) {
      await persistGscConnectionError('invalid_token_response');
      return errorRedirect('invalid_token_response');
    }

    // Get connected user email
    let email: string | null = null;
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal:  AbortSignal.timeout(5_000),
      });
      if (uRes.ok) email = ((await uRes.json()) as { email?: string }).email ?? null;
    } catch { /* non-fatal */ }

    // Get verified GSC properties, prefer site matching our domain
    let siteUrl = 'https://www.istanbulviptransfer.com/';
    try {
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal:  AbortSignal.timeout(8_000),
      });
      if (sitesRes.ok) {
        const sites = await sitesRes.json() as {
          siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
        };
        const entries = sites.siteEntry ?? [];
        const preferred = entries
          .sort((a) => (a.permissionLevel === 'siteOwner' ? -1 : 1))
          .find((s) => s.siteUrl.includes('istanbulviptransfer')) ?? entries[0];
        if (preferred) siteUrl = preferred.siteUrl;
      }
    } catch { /* use default */ }

    const expiry = new Date(Date.now() + tokens.expires_in * 1_000);

    // Upsert — single-row pattern
    const { db } = await import('@/db');
    const { gscConnections } = await import('@/db/schema');
    await db.delete(gscConnections);
    await db.insert(gscConnections).values({
      siteUrl, accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      connected: true, enabled: true, lastError: null, tokenExpiry: expiry,
      scope: tokens.scope, connectedEmail: email,
    });

    // Clear CSRF cookies and redirect to success
    const successUrl = new URL(`${settingsBase}?success=gsc_connected`, req.url);
    const response   = NextResponse.redirect(successUrl);
    response.cookies.delete('gsc_oauth_state');
    response.cookies.delete('gsc_redirect_uri');
    return response;

  } catch {
    console.error('[GSC callback] server_error');
    await persistGscConnectionError('server_error');
    return errorRedirect('server_error');
  }
}
