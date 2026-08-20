import 'server-only';

import { eq } from 'drizzle-orm';
import { TwitterApi } from 'twitter-api-v2';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';
import { decrypt } from '@/lib/email-crypto';
import { ensureSocialPlatforms } from '@/lib/social-platforms';

const META_GRAPH_VERSION = 'v22.0';

export type PublishResult = {
  id: string;
  url: string | null;
};

function safeXErrorBody(value: unknown) {
  const sensitiveKey = /token|secret|authorization|cookie|signature|oauth/i;
  try {
    return JSON.stringify(value, (key, item) => sensitiveKey.test(key) ? '[REDACTED]' : item);
  } catch {
    return String(value);
  }
}

function getXApiErrorMessage(error: unknown) {
  if (typeof error === 'object' && error) {
    const apiError = error as { code?: unknown; data?: unknown; message?: unknown };
    const status = typeof apiError.code === 'number' ? apiError.code : null;
    if (apiError.data !== undefined) {
      return `X API ${status ?? 'istek hatası'}: ${safeXErrorBody(apiError.data)}`;
    }
    if (typeof apiError.message === 'string') {
      return `X API ${status ?? 'istek hatası'}: ${apiError.message}`;
    }
  }
  return 'X paylaşımı başarısız.';
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
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    });
    const response = await client.v2.tweet(text.slice(0, 280));
    const id = response.data.id;
    const result = { id, url: `https://x.com/i/web/status/${id}` };
    await storePublicationResult('x', result, null);
    return result;
  } catch (error) {
    const message = getXApiErrorMessage(error);
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