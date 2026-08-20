import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
const META_CALLBACK_PATH = '/admin/api/social-platforms/meta/callback';

function getMetaCallbackUri(req: NextRequest) {
  return new URL(META_CALLBACK_PATH, req.url).toString();
}

export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=meta_credentials_missing`, req.url));
  }
  if (!configId) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=meta_login_config_missing`, req.url));
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const redirectUri = getMetaCallbackUri(req);
  const params = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  const response = NextResponse.redirect(`https://www.facebook.com/${'v22.0'}/dialog/oauth?${params}`);
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}