/**
 * GET /admin/api/gsc/callback
 * Handles the Google OAuth2 callback for Search Console.
 * Exchanges the authorization code for tokens and stores them in the DB.
 *
 * Registered in Google Cloud Console as:
 *   https://www.istanbulviptransfer.com/admin/api/gsc/callback
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.redirect(new URL('/admin/login', req.url)); }

  const url      = new URL(req.url);
  const code     = url.searchParams.get('code');
  const state    = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  const settingsBase = '/admin/ayarlar/icerik-entegrasyonlari';

  function errorRedirect(err: string) {
    return NextResponse.redirect(new URL(`${settingsBase}?error=${err}`, req.url));
  }

  if (errParam) return errorRedirect(errParam);

  // CSRF check
  const storedState = req.cookies.get('gsc_oauth_state')?.value;
  if (!storedState || storedState !== state) return errorRedirect('invalid_state');

  const redirectUri = req.cookies.get('gsc_redirect_uri')?.value;
  if (!code || !redirectUri) return errorRedirect('missing_code');

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
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      console.error('[GSC callback] Token exchange failed:', tokenRes.status, await tokenRes.text());
      return errorRedirect('token_exchange_failed');
    }

    const tokens = await tokenRes.json() as {
      access_token:  string;
      refresh_token?: string;
      expires_in:    number;
      scope:         string;
    };

    if (!tokens.refresh_token) return errorRedirect('no_refresh_token');

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
    await db.execute(`DELETE FROM gsc_connections` as never);
    await db.execute(
      `INSERT INTO gsc_connections
         (site_url, access_token, refresh_token, token_expiry, scope, connected_email, connected_at, updated_at)
       VALUES
         ('${siteUrl}', '${tokens.access_token}', '${tokens.refresh_token}',
          '${expiry.toISOString()}', '${tokens.scope}',
          ${email ? `'${email.replace(/'/g, "''")}'` : 'NULL'},
          NOW(), NOW())` as never,
    );

    // Clear CSRF cookies and redirect to success
    const successUrl = new URL(`${settingsBase}?success=gsc_connected`, req.url);
    const response   = NextResponse.redirect(successUrl);
    response.cookies.delete('gsc_oauth_state');
    response.cookies.delete('gsc_redirect_uri');
    return response;

  } catch (err) {
    console.error('[GSC callback]', err instanceof Error ? err.message : 'unknown');
    return errorRedirect('server_error');
  }
}
