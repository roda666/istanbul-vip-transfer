import { NextRequest, NextResponse } from 'next/server';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { createOAuth1AuthorizationHeader } from '@/lib/social-publish';
import { encrypt, isEncryptionReady } from '@/lib/email-crypto';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
const X_CALLBACK = 'https://www.istanbulviptransfer.com/admin/api/social-platforms/x/callback';
const REQUEST_TOKEN_URL = 'https://api.x.com/oauth/request_token';

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
    const response = await fetch(REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: createOAuth1AuthorizationHeader({
          method: 'POST',
          url: REQUEST_TOKEN_URL,
          consumerKey,
          consumerSecret,
          extraOAuthParams: { oauth_callback: X_CALLBACK },
        }),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = new URLSearchParams(await response.text());
    const token = payload.get('oauth_token');
    const secret = payload.get('oauth_token_secret');
    if (!response.ok || !token || !secret) throw new Error('X request token alınamadı.');
    const encryptedSecret = encrypt(secret);
    if (!encryptedSecret) throw new Error('X request token şifrelenemedi.');

    const redirect = NextResponse.redirect(`https://api.x.com/oauth/authorize?oauth_token=${encodeURIComponent(token)}`);
    const options = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
    redirect.cookies.set('x_oauth_request_token', token, options);
    redirect.cookies.set('x_oauth_request_secret', encryptedSecret, options);
    return redirect;
  } catch (error) {
    console.error('[x connect]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=x_request_token_failed`, req.url));
  }
}