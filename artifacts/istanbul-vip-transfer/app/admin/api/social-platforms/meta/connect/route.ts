import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { getMetaCallbackUri } from '@/lib/meta-oauth';

export const dynamic = 'force-dynamic';

const SETTINGS_PATH = '/admin/ayarlar/icerik-entegrasyonlari';
const META_SCOPE = [
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL(`${SETTINGS_PATH}?social_error=meta_credentials_missing`, req.url));
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const redirectUri = getMetaCallbackUri(req);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: META_SCOPE,
  });
  const response = NextResponse.redirect(`https://www.facebook.com/${'v22.0'}/dialog/oauth?${params}`);
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}