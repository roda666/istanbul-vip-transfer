import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { TwitterApi } from 'twitter-api-v2';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { decrypt, encrypt } from '@/lib/email-crypto';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';
import { ensureSocialPlatforms } from '@/lib/social-platforms';
import { socialOAuthCallbackResponse } from '@/lib/social-oauth-callback';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    const fallback = new URL(SETTINGS_PATH, req.url);
    fallback.searchParams.set('social_error', 'unauthorized');
    return socialOAuthCallbackResponse(req, { provider: 'x', success: false, error: response.error }, fallback.toString());
  }

  const url = new URL(req.url);
  const oauthToken = url.searchParams.get('oauth_token');
  const verifier = url.searchParams.get('oauth_verifier');
  const requestToken = req.cookies.get('x_oauth_request_token')?.value;
  const encryptedRequestSecret = req.cookies.get('x_oauth_request_secret')?.value;
  const requestSecret = encryptedRequestSecret ? decrypt(encryptedRequestSecret) : null;
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const callbackResult = (value: string) => {
    const fallback = new URL(SETTINGS_PATH, req.url);
    fallback.searchParams.set('social_error', value);
    return socialOAuthCallbackResponse(req, { provider: 'x', success: false, error: value }, fallback.toString());
  };

  if (!oauthToken || !verifier || oauthToken !== requestToken || !requestSecret || !consumerKey || !consumerSecret) {
    return callbackResult('x_invalid_state');
  }

  try {
    await ensureSocialPlatforms();
    const requestClient = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: oauthToken,
      accessSecret: requestSecret,
    });
    const login = await requestClient.login(verifier);
    const encryptedToken = encrypt(login.accessToken);
    const encryptedSecret = encrypt(login.accessSecret);
    if (!encryptedToken || !encryptedSecret) throw new Error('X access token şifrelenemedi.');

    await db.update(socialPlatforms).set({
      connected: true,
      accessTokenEncrypted: encryptedToken,
      accessTokenSecretEncrypted: encryptedSecret,
      connectionMeta: { screenName: login.screenName, source: 'oauth1' },
      connectedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, 'x'));
    const fallback = new URL(SETTINGS_PATH, req.url);
    fallback.searchParams.set('social_success', 'x_connected');
    const success = socialOAuthCallbackResponse(
      req,
      { provider: 'x', success: true, message: 'X bağlantısı tamamlandı.' },
      fallback.toString(),
    );
    success.cookies.delete('x_oauth_request_token');
    success.cookies.delete('x_oauth_request_secret');
    return success;
  } catch (error) {
    console.error('[x callback]', error instanceof Error ? error.message : 'unknown');
    return callbackResult('x_access_token_failed');
  }
}