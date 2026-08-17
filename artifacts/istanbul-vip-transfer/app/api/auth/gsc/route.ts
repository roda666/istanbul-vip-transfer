/**
 * GET /api/auth/gsc
 * Starts the Google OAuth2 flow for Search Console access.
 * Requires GOOGLE_CLIENT_ID env var.
 * Scope: https://www.googleapis.com/auth/webmasters.readonly
 *
 * Redirects the browser to Google's consent screen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Must be an admin to connect GSC
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        '/admin/ayarlar/icerik-entegrasyonlari?error=missing_client_id',
        req.url,
      ),
    );
  }

  // Build callback URL — must match Google Cloud Console "Authorized redirect URI"
  const origin      = req.headers.get('x-forwarded-host')
    ? `https://${req.headers.get('x-forwarded-host')}`
    : new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/gsc/callback`;

  // CSRF state token — simple timestamp-based, stored in cookie
  const state = Buffer.from(JSON.stringify({ ts: Date.now(), origin })).toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/webmasters.readonly',
    access_type:   'offline',
    prompt:        'consent',        // force to always get refresh_token
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  // Store state + redirectUri in a short-lived cookie for callback verification
  response.cookies.set('gsc_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  response.cookies.set('gsc_redirect_uri', redirectUri, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });

  return response;
}
