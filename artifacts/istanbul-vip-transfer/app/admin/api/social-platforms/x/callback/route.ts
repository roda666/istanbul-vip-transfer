import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { createOAuth1AuthorizationHeader } from '@/lib/social-publish';
import { decrypt, encrypt } from '@/lib/email-crypto';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';
import { ensureSocialPlatforms } from '@/lib/social-platforms';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
const ACCESS_TOKEN_URL = 'https://api.x.com/oauth/access_token';

export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const url = new URL(req.url);
  const oauthToken = url.searchParams.get('oauth_token');
  const verifier = url.searchParams.get('oauth_verifier');
  const requestToken = req.cookies.get('x_oauth_request_token')?.value;
  const encryptedRequestSecret = req.cookies.get('x_oauth_request_secret')?.value;
  const requestSecret = encryptedRequestSecret ? decrypt(encryptedRequestSecret) : null;
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const redirect = (value: string) => NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=${value}`, req.url));

  if (!oauthToken || !verifier || oauthToken !== requestToken || !requestSecret || !consumerKey || !consumerSecret) {
    return redirect('x_invalid_state');
  }

  try {
    await ensureSocialPlatforms();
    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: createOAuth1AuthorizationHeader({
          method: 'POST',
          url: ACCESS_TOKEN_URL,
          consumerKey,
          consumerSecret,
          token: oauthToken,
          tokenSecret: requestSecret,
          extraOAuthParams: { oauth_verifier: verifier },
        }),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = new URLSearchParams(await response.text());
    const accessToken = payload.get('oauth_token');
    const accessTokenSecret = payload.get('oauth_token_secret');
    const screenName = payload.get('screen_name');
    if (!response.ok || !accessToken || !accessTokenSecret) throw new Error('X access token alınamadı.');
    const encryptedToken = encrypt(accessToken);
    const encryptedSecret = encrypt(accessTokenSecret);
    if (!encryptedToken || !encryptedSecret) throw new Error('X access token şifrelenemedi.');

    await db.update(socialPlatforms).set({
      connected: true,
      accessTokenEncrypted: encryptedToken,
      accessTokenSecretEncrypted: encryptedSecret,
      connectionMeta: { screenName: screenName ?? null, source: 'oauth1' },
      connectedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, 'x'));
    const success = NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_success=x_connected`, req.url));
    success.cookies.delete('x_oauth_request_token');
    success.cookies.delete('x_oauth_request_secret');
    return success;
  } catch (error) {
    console.error('[x callback]', error instanceof Error ? error.message : 'unknown');
    return redirect('x_access_token_failed');
  }
}