/**
 * GET /api/auth/gsc/callback
 * Handles the Google OAuth2 callback for Search Console.
 * Exchanges the authorization code for tokens and stores them in the DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Must be an admin session
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const url     = new URL(req.url);
  const code    = url.searchParams.get('code');
  const state   = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  const settingsUrl = new URL('/admin/ayarlar/icerik-entegrasyonlari', req.url);

  if (errParam) {
    settingsUrl.searchParams.set('error', errParam);
    return NextResponse.redirect(settingsUrl);
  }

  // CSRF check
  const storedState = req.cookies.get('gsc_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    settingsUrl.searchParams.set('error', 'invalid_state');
    return NextResponse.redirect(settingsUrl);
  }

  const redirectUri = req.cookies.get('gsc_redirect_uri')?.value;
  if (!code || !redirectUri) {
    settingsUrl.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(settingsUrl);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    settingsUrl.searchParams.set('error', 'missing_credentials');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      console.error('[GSC callback] Token exchange failed:', tokenRes.status);
      settingsUrl.searchParams.set('error', 'token_exchange_failed');
      return NextResponse.redirect(settingsUrl);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    if (!tokens.refresh_token) {
      settingsUrl.searchParams.set('error', 'no_refresh_token');
      return NextResponse.redirect(settingsUrl);
    }

    // Get user email from Google
    let email: string | null = null;
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (uRes.ok) {
        const u = await uRes.json() as { email?: string };
        email = u.email ?? null;
      }
    } catch { /* ignore, email is optional */ }

    // Get list of verified sites from Search Console to store the primary one
    let siteUrl = 'https://www.istanbulviptransfer.com/';
    try {
      const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (sitesRes.ok) {
        const sites = await sitesRes.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
        // prefer sc-domain: property, otherwise first URL property
        const preferred = (sites.siteEntry ?? [])
          .sort((a) => a.permissionLevel === 'siteOwner' ? -1 : 1)
          .find(s => s.siteUrl.includes('istanbulviptransfer')) ?? (sites.siteEntry ?? [])[0];
        if (preferred) siteUrl = preferred.siteUrl;
      }
    } catch { /* use default */ }

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert into gsc_connections (single-row pattern: delete all, insert fresh)
    const { db } = await import('@/db');
    await db.execute(`DELETE FROM gsc_connections` as never);
    await db.execute(
      `INSERT INTO gsc_connections (site_url, access_token, refresh_token, token_expiry, scope, connected_email, connected_at, updated_at)
       VALUES ('${siteUrl}', '${tokens.access_token}', '${tokens.refresh_token}', '${expiry.toISOString()}', '${tokens.scope}', ${email ? `'${email}'` : 'NULL'}, NOW(), NOW())` as never
    );

    // Clear state cookies
    const successUrl = new URL('/admin/ayarlar/icerik-entegrasyonlari', req.url);
    successUrl.searchParams.set('success', 'gsc_connected');
    const response = NextResponse.redirect(successUrl);
    response.cookies.delete('gsc_oauth_state');
    response.cookies.delete('gsc_redirect_uri');
    return response;
  } catch (err) {
    console.error('[GSC callback] Error:', err instanceof Error ? err.message : 'unknown');
    settingsUrl.searchParams.set('error', 'server_error');
    return NextResponse.redirect(settingsUrl);
  }
}
