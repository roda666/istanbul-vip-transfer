import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { getPublicUrl, getSocialSettingsUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(getSocialSettingsUrl(req, { social_error: 'google_business_credentials_missing' }));
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const redirectUri = getPublicUrl(req, '/admin/api/social-platforms/google-business/callback');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 600, path: '/' };
  response.cookies.set('google_business_oauth_state', state, cookieOptions);
  response.cookies.set('google_business_redirect_uri', redirectUri, cookieOptions);
  return response;
}