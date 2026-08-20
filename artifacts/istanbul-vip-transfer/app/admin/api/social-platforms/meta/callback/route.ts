import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';
import { encrypt, isEncryptionReady } from '@/lib/email-crypto';
import { ensureSocialPlatforms } from '@/lib/social-platforms';
import { socialOAuthCallbackResponse } from '@/lib/social-oauth-callback';
import { getPublicUrl, getSocialSettingsUrl } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

const graphUrl = (path: string, params: URLSearchParams) => `https://graph.facebook.com/v22.0/${path}?${params}`;

export async function GET(req: NextRequest) {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    const fallback = getSocialSettingsUrl(req, { social_error: 'unauthorized' });
    return socialOAuthCallbackResponse(req, { provider: 'meta', success: false, error: response.error }, fallback);
  }

  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const callbackResult = (value: string) => {
    const fallback = getSocialSettingsUrl(req, { social_error: value });
    return socialOAuthCallbackResponse(req, { provider: 'meta', success: false, error: value }, fallback);
  };
  if (error) return callbackResult(`meta_${error}`);
  if (!code || state !== req.cookies.get('meta_oauth_state')?.value) return callbackResult('meta_invalid_state');
  if (!isEncryptionReady()) return callbackResult('encryption_key_missing');

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return callbackResult('meta_credentials_missing');

  try {
    await ensureSocialPlatforms();
    const redirectUri = getPublicUrl(req, '/admin/api/social-platforms/meta/callback');
    const tokenResponse = await fetch(graphUrl('oauth/access_token', new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
    })), { signal: AbortSignal.timeout(15_000) });
    const tokenPayload = await tokenResponse.json() as { access_token?: string; error?: { message?: string } };
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(tokenPayload.error?.message ?? 'Meta token alınamadı.');

    const longTokenResponse = await fetch(graphUrl('oauth/access_token', new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: tokenPayload.access_token,
    })), { signal: AbortSignal.timeout(15_000) });
    const longTokenPayload = await longTokenResponse.json() as { access_token?: string; error?: { message?: string } };
    if (!longTokenResponse.ok || !longTokenPayload.access_token) throw new Error(longTokenPayload.error?.message ?? 'Uzun ömürlü Meta token alınamadı.');

    const pagesResponse = await fetch(graphUrl('me/accounts', new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: longTokenPayload.access_token,
    })), { signal: AbortSignal.timeout(15_000) });
    const pagesPayload = await pagesResponse.json() as {
      data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id?: string; username?: string } }>;
      error?: { message?: string };
    };
    const page = pagesPayload.data?.[0];
    if (!pagesResponse.ok || !page?.access_token) throw new Error(pagesPayload.error?.message ?? 'Yönetilebilir Facebook Sayfası bulunamadı.');

    const pageAccessToken = page.access_token;
    const encryptedPageAccessToken = encrypt(pageAccessToken);
    if (!encryptedPageAccessToken) throw new Error('Meta Sayfa tokenı şifrelenemedi.');
    const now = new Date();
    await db.update(socialPlatforms).set({
      connected: true,
      accessTokenEncrypted: encryptedPageAccessToken,
      connectionMeta: { pageId: page.id, pageName: page.name, tokenType: 'page' },
      connectedAt: now,
      lastError: null,
      updatedAt: now,
    }).where(eq(socialPlatforms.key, 'facebook'));

    const instagram = page.instagram_business_account;
    await db.update(socialPlatforms).set({
      connected: Boolean(instagram?.id),
      accessTokenEncrypted: instagram?.id ? encryptedPageAccessToken : null,
      connectionMeta: instagram?.id ? {
        instagramAccountId: instagram.id,
        instagramUsername: instagram.username ?? null,
        pageId: page.id,
        tokenType: 'page',
      } : {},
      connectedAt: instagram?.id ? now : null,
      lastError: instagram?.id ? null : 'Seçilen Facebook Sayfasına bağlı profesyonel Instagram hesabı yok.',
      updatedAt: now,
    }).where(eq(socialPlatforms.key, 'instagram'));

    const fallback = getSocialSettingsUrl(req, { social_success: 'meta_connected' });
    const response = socialOAuthCallbackResponse(
      req,
      { provider: 'meta', success: true, message: 'Facebook ve Instagram bağlantısı tamamlandı.' },
      fallback,
    );
    response.cookies.delete('meta_oauth_state');
    return response;
  } catch (caught) {
    console.error('[meta callback]', caught instanceof Error ? caught.message : 'unknown');
    return callbackResult('meta_connection_failed');
  }
}