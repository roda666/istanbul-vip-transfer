/**
 * GET /admin/api/google-ads/connect
 * Starts the Google OAuth2 flow for Ads API (Keyword Planner) access.
 * Adds both Search Console AND Google Ads scopes so a single consent covers both.
 *
 * The redirect URI is derived from the public request host so preview and
 * production OAuth flows can each use their own registered URI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { getPublicUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/admin/ayarlar/icerik-entegrasyonlari?error=missing_client_id', req.url),
    );
  }

  // Google requires an exact match. Store the dynamic public URI so the
  // callback token exchange uses exactly the URI sent to Google's consent page.
  const redirectUri = getPublicUrl(req, '/admin/api/google-ads/callback');

  const state = Buffer.from(JSON.stringify({ ts: Date.now(), svc: 'google_ads' })).toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    // Both scopes in one consent — Ads API requires adwords scope
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent',  // always get refresh_token
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
  response.cookies.set('gads_oauth_state',    state,       cookieOpts);
  response.cookies.set('gads_redirect_uri',   redirectUri, cookieOpts);

  return response;
}
