/**
 * GET /admin/api/gsc/connect
 * Starts the Google OAuth2 flow for Search Console access.
 * Redirects to Google's consent screen.
 *
 * NOTE: This route intentionally lives under /admin/api/ (not /api/) because
 * the Replit router forwards all /api/* requests to the standalone api-server
 * artifact. Next.js route handlers placed under /api/ are unreachable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { getPublicUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Must be logged-in admin
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/admin/ayarlar/icerik-entegrasyonlari?error=missing_client_id', req.url),
    );
  }

  // Google requires an exact match, so use the same public origin for the
  // authorization request and callback token exchange. This supports both
  // Replit preview and the production host.
  const redirectUri = getPublicUrl(req, '/admin/api/gsc/callback');

  // CSRF state — base64url-encoded JSON, verified in callback
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/webmasters.readonly',
    access_type:   'offline',
    prompt:        'consent',   // always get refresh_token
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  // Store state + redirectUri in short-lived httpOnly cookies for callback verification
  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
  response.cookies.set('gsc_oauth_state',    state,       cookieOpts);
  response.cookies.set('gsc_redirect_uri',   redirectUri, cookieOpts);

  return response;
}
