import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { encrypt, isEncryptionReady } from '@/lib/email-crypto';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
const X_CALLBACK = 'https://www.istanbulviptransfer.com/admin/api/social-platforms/x/callback';
export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret || !isEncryptionReady()) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=x_credentials_missing`, req.url));
  }

  try {
    const client = new TwitterApi({ appKey: consumerKey, appSecret: consumerSecret });
    const tokenRequest = await client.generateAuthLink(X_CALLBACK, {
      authAccessType: 'write',
      linkMode: 'authorize',
    });
    const encryptedSecret = encrypt(tokenRequest.oauth_token_secret);
    if (!encryptedSecret) throw new Error('X request token şifrelenemedi.');

    const redirect = NextResponse.redirect(tokenRequest.url);
    const options = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
    redirect.cookies.set('x_oauth_request_token', tokenRequest.oauth_token, options);
    redirect.cookies.set('x_oauth_request_secret', encryptedSecret, options);
    return redirect;
  } catch (error) {
    console.error('[x connect]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=x_request_token_failed`, req.url));
  }
}