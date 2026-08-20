import 'server-only';

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';
import { decrypt } from '@/lib/email-crypto';
import { ensureSocialPlatforms } from '@/lib/social-platforms';

const META_GRAPH_VERSION = 'v22.0';
const X_API_URL = 'https://api.x.com/2/tweets';

export type PublishResult = {
  id: string;
  url: string | null;
};

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

type OAuth1Options = {
  method: 'POST' | 'GET';
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  extraOAuthParams?: Record<string, string>;
};

export function createOAuth1AuthorizationHeader(options: OAuth1Options) {
  const url = new URL(options.url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: options.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...options.extraOAuthParams,
  };

  if (options.token) oauthParams.oauth_token = options.token;

  const signatureParams = [
    ...Array.from(url.searchParams.entries()),
    ...Object.entries(oauthParams),
  ].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const left = `${percentEncode(leftKey)}=${percentEncode(leftValue)}`;
    const right = `${percentEncode(rightKey)}=${percentEncode(rightValue)}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const normalized = signatureParams
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&');
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const signatureBase = [
    options.method,
    percentEncode(baseUrl),
    percentEncode(normalized),
  ].join('&');
  const signingKey = `${percentEncode(options.consumerSecret)}&${percentEncode(options.tokenSecret ?? '')}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  return `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')}`;
}

async function getPlatform(key: 'facebook' | 'instagram' | 'x') {
  await ensureSocialPlatforms();
  const [platform] = await db.select().from(socialPlatforms)
    .where(eq(socialPlatforms.key, key))
    .limit(1);
  if (!platform?.connected) throw new Error(`${key} bağlantısı tamamlanmamış.`);
  if (!platform.enabled) throw new Error(`${key} kanalı pasif. Paylaşmadan önce platformu aktifleştirin.`);
  return platform;
}

async function storePublicationResult(
  key: 'facebook' | 'instagram' | 'x',
  result: PublishResult | null,
  error: string | null,
) {
  await db.update(socialPlatforms).set({
    lastPublishId: result?.id ?? null,
    lastPublishUrl: result?.url ?? null,
    lastError: error,
    updatedAt: new Date(),
  }).where(eq(socialPlatforms.key, key));
}

function getEncryptedToken(platform: { accessTokenEncrypted: string | null }, label: string) {
  const token = platform.accessTokenEncrypted ? decrypt(platform.accessTokenEncrypted) : null;
  if (!token) throw new Error(`${label} erişim token'ı okunamadı.`);
  return token;
}

export async function publishFacebookPost(input: { message: string; link?: string }) {
  const platform = await getPlatform('facebook');
  const metadata = platform.connectionMeta as { pageId?: string };
  const pageId = metadata.pageId;
  if (!pageId) throw new Error('Facebook Sayfası seçilmemiş.');

  try {
    const token = getEncryptedToken(platform, 'Facebook');
    const body = new URLSearchParams({ message: input.message, access_token: token });
    if (input.link) body.set('link', input.link);
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok || !payload.id) throw new Error(payload.error?.message ?? `Facebook API ${response.status}`);
    const result = { id: payload.id, url: null };
    await storePublicationResult('facebook', result, null);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Facebook paylaşımı başarısız.';
    await storePublicationResult('facebook', null, message);
    throw error;
  }
}

export async function publishInstagramPost(input: { caption: string; imageUrl: string }) {
  const platform = await getPlatform('instagram');
  const metadata = platform.connectionMeta as { instagramAccountId?: string };
  const instagramAccountId = metadata.instagramAccountId;
  if (!instagramAccountId) throw new Error('Instagram profesyonel hesabı seçilmemiş.');
  if (!/^https:\/\//.test(input.imageUrl)) throw new Error('Instagram için herkese açık HTTPS görsel URL’si gerekli.');

  try {
    const token = getEncryptedToken(platform, 'Instagram');
    const createBody = new URLSearchParams({
      image_url: input.imageUrl,
      caption: input.caption,
      access_token: token,
    });
    const createResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: createBody,
        signal: AbortSignal.timeout(15_000),
      },
    );
    const createPayload = await createResponse.json() as { id?: string; error?: { message?: string } };
    if (!createResponse.ok || !createPayload.id) throw new Error(createPayload.error?.message ?? `Instagram API ${createResponse.status}`);

    const publishResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ creation_id: createPayload.id, access_token: token }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const publishPayload = await publishResponse.json() as { id?: string; error?: { message?: string } };
    if (!publishResponse.ok || !publishPayload.id) throw new Error(publishPayload.error?.message ?? `Instagram API ${publishResponse.status}`);
    const result = { id: publishPayload.id, url: null };
    await storePublicationResult('instagram', result, null);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram paylaşımı başarısız.';
    await storePublicationResult('instagram', null, message);
    throw error;
  }
}

export async function publishXTweet(text: string) {
  if (!text.trim()) throw new Error('Tweet metni boş olamaz.');
  const platform = await getPlatform('x');
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const storedToken = platform.accessTokenEncrypted ? decrypt(platform.accessTokenEncrypted) : null;
  const storedTokenSecret = platform.accessTokenSecretEncrypted ? decrypt(platform.accessTokenSecretEncrypted) : null;
  const accessToken = storedToken ?? process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = storedTokenSecret ?? process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error('X OAuth 1.0a User Context bilgileri eksik.');
  }

  try {
    const response = await fetch(X_API_URL, {
      method: 'POST',
      headers: {
        Authorization: createOAuth1AuthorizationHeader({
          method: 'POST',
          url: X_API_URL,
          consumerKey,
          consumerSecret,
          token: accessToken,
          tokenSecret: accessTokenSecret,
        }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.slice(0, 280) }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as {
      data?: { id?: string };
      detail?: string;
      title?: string;
      errors?: Array<{ message?: string }>;
    };
    const id = payload.data?.id;
    if (!response.ok || !id) {
      const providerMessage = payload.detail ?? payload.errors?.[0]?.message ?? payload.title ?? 'Bilinmeyen X API hatası';
      throw new Error(`X API ${response.status}: ${providerMessage}`);
    }
    const result = { id, url: `https://x.com/i/web/status/${id}` };
    await storePublicationResult('x', result, null);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'X paylaşımı başarısız.';
    await storePublicationResult('x', null, message);
    if (/^X API (401|403):/.test(message)) {
      await db.update(socialPlatforms).set({
        connected: false,
        enabled: false,
        updatedAt: new Date(),
      }).where(eq(socialPlatforms.key, 'x'));
    }
    throw error;
  }
}