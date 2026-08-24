import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { googleReviews, socialPlatforms } from '@/db/schema';
import { decrypt, encrypt, isEncryptionReady } from '@/lib/email-crypto';
import { ensureSocialPlatforms } from '@/lib/social-platforms';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ACCOUNT_MANAGEMENT_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFORMATION_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const MY_BUSINESS_URL = 'https://mybusiness.googleapis.com/v4';
const GOOGLE_BUSINESS_KEY = 'google_business';
const ACCESS_TOKEN_SKEW_MS = 60_000;

type GoogleBusinessMeta = {
  accountName?: string;
  accountLabel?: string;
  locationName?: string;
  locationLabel?: string;
  scopes?: string[];
  lastReviewSyncAt?: string;
  lastReviewSyncCount?: number;
  reviewSyncStatus?: 'scheduled' | 'manual' | 'error';
  nextReviewSyncAt?: string;
};

type GoogleBusinessPlatform = typeof socialPlatforms.$inferSelect;

export type GoogleBusinessLocationOption = {
  accountName: string;
  accountLabel: string;
  locationName: string;
  locationLabel: string;
};

export type GoogleBusinessReviewSyncResult = {
  received: number;
  upserted: number;
  skipped: number;
  syncedAt: string;
};

function safeGoogleMessage(status?: number) {
  return status ? `Google Business Profile isteği başarısız oldu (HTTP ${status}).` : 'Google Business Profile isteği başarısız oldu.';
}

function metaOf(platform: GoogleBusinessPlatform): GoogleBusinessMeta {
  const value = platform.connectionMeta;
  return value && typeof value === 'object' ? value as GoogleBusinessMeta : {};
}

function hasSelection(meta: GoogleBusinessMeta) {
  return Boolean(meta.accountName && meta.locationName);
}

async function getGoogleBusinessPlatform(options: { requireEnabled?: boolean; requireSelection?: boolean } = {}) {
  await ensureSocialPlatforms();
  const [platform] = await db.select().from(socialPlatforms)
    .where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY))
    .limit(1);

  if (!platform?.connected) throw new Error('Google Business Profile bağlantısı tamamlanmamış.');
  if (options.requireEnabled && !platform.enabled) throw new Error('Google Business Profile kanalı pasif.');
  if (options.requireSelection && !hasSelection(metaOf(platform))) {
    throw new Error('Önce Google hesabı ve işletme konumu seçilmeli.');
  }
  return platform;
}

async function getValidAccessToken(platform: GoogleBusinessPlatform) {
  const existing = platform.accessTokenEncrypted ? decrypt(platform.accessTokenEncrypted) : null;
  const expiresSoon = !platform.tokenExpiresAt || platform.tokenExpiresAt.getTime() <= Date.now() + ACCESS_TOKEN_SKEW_MS;
  if (existing && !expiresSoon) return existing;

  const refreshToken = platform.accessTokenSecretEncrypted ? decrypt(platform.accessTokenSecretEncrypted) : null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret || !isEncryptionReady()) {
    throw new Error('Google Business Profile bağlantısı yenilenemedi. Lütfen yeniden bağlanın.');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !payload?.access_token) {
    await db.update(socialPlatforms).set({
      enabled: false,
      lastError: 'google_token_refresh_failed',
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY));
    throw new Error('Google Business Profile bağlantısı yenilenemedi. Lütfen yeniden bağlanın.');
  }

  const encryptedToken = encrypt(payload.access_token);
  if (!encryptedToken) throw new Error('Google Business Profile erişim tokenı şifrelenemedi.');
  const expiresAt = new Date(Date.now() + Math.max(60, payload.expires_in ?? 3_600) * 1_000);
  await db.update(socialPlatforms).set({
    accessTokenEncrypted: encryptedToken,
    tokenExpiresAt: expiresAt,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY));
  return payload.access_token;
}

async function googleJson<T>(path: string, init: RequestInit = {}, platform?: GoogleBusinessPlatform): Promise<T> {
  const activePlatform = platform ?? await getGoogleBusinessPlatform();
  const token = await getValidAccessToken(activePlatform);
  const response = await fetch(`${path.startsWith('http') ? '' : MY_BUSINESS_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const message = safeGoogleMessage(response.status);
    await db.update(socialPlatforms).set({
      lastError: `google_api_${response.status}`,
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY));
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getGoogleBusinessLocationOptions(): Promise<GoogleBusinessLocationOption[]> {
  const platform = await getGoogleBusinessPlatform();
  const token = await getValidAccessToken(platform);
  const accountsResponse = await fetch(`${ACCOUNT_MANAGEMENT_URL}/accounts?pageSize=20`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!accountsResponse.ok) throw new Error(safeGoogleMessage(accountsResponse.status));
  const accountsPayload = await accountsResponse.json() as {
    accounts?: Array<{ name?: string; accountName?: string }>;
  };

  const options: GoogleBusinessLocationOption[] = [];
  for (const account of accountsPayload.accounts ?? []) {
    if (!account.name?.startsWith('accounts/')) continue;
    const locationsResponse = await fetch(
      `${BUSINESS_INFORMATION_URL}/${account.name}/locations?readMask=name,title&pageSize=100`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!locationsResponse.ok) continue;
    const locationsPayload = await locationsResponse.json() as {
      locations?: Array<{ name?: string; title?: string }>;
    };
    for (const location of locationsPayload.locations ?? []) {
      if (!location.name?.startsWith(`${account.name}/locations/`)) continue;
      options.push({
        accountName: account.name,
        accountLabel: account.accountName ?? account.name,
        locationName: location.name,
        locationLabel: location.title ?? location.name,
      });
    }
  }
  return options;
}

export async function selectGoogleBusinessLocation(
  option: Pick<GoogleBusinessLocationOption, 'accountName' | 'locationName'>,
) {
  const options = await getGoogleBusinessLocationOptions();
  const selected = options.find((item) =>
    item.accountName === option.accountName && item.locationName === option.locationName,
  );
  if (!selected) throw new Error('Seçilen Google Business Profile konumu erişilebilir değil.');

  const platform = await getGoogleBusinessPlatform();
  const previous = metaOf(platform);
  const connectionMeta: GoogleBusinessMeta = {
    ...previous,
    accountName: selected.accountName,
    accountLabel: selected.accountLabel,
    locationName: selected.locationName,
    locationLabel: selected.locationLabel,
  };
  const [updated] = await db.update(socialPlatforms).set({
    connectionMeta,
    enabled: false,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY)).returning();
  return updated;
}

export async function publishGoogleBusinessPost(input: { text: string; url?: string }) {
  const text = input.text.trim();
  if (!text) throw new Error('Google gönderisi boş olamaz.');
  const platform = await getGoogleBusinessPlatform({ requireEnabled: true, requireSelection: true });
  const meta = metaOf(platform);
  const body: Record<string, unknown> = {
    languageCode: 'tr',
    summary: text.slice(0, 1_500),
    topicType: 'STANDARD',
  };
  if (input.url) {
    body.callToAction = { actionType: 'LEARN_MORE', url: input.url };
  }

  try {
    const post = await googleJson<{ name?: string }>(
      `${MY_BUSINESS_URL}/${meta.locationName}/localPosts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      platform,
    );
    if (!post.name) throw new Error('Google Business Profile gönderi kimliği dönmedi.');
    const result = { id: post.name, url: null };
    await db.update(socialPlatforms).set({
      lastPublishId: result.id,
      lastPublishUrl: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY));
    return result;
  } catch (error) {
    await db.update(socialPlatforms).set({
      lastError: error instanceof Error ? 'google_post_failed' : 'google_post_failed',
      updatedAt: new Date(),
    }).where(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY));
    throw error;
  }
}

const RATING_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

export async function syncGoogleBusinessReviews(options: { requireEnabled?: boolean; source?: 'scheduled' | 'manual' } = {}): Promise<GoogleBusinessReviewSyncResult> {
  const platform = await getGoogleBusinessPlatform({
    requireEnabled: options.requireEnabled,
    requireSelection: true,
  });
  const meta = metaOf(platform);
  const reviews: Array<{
    name?: string;
    reviewer?: { displayName?: string };
    comment?: string;
    starRating?: string;
    createTime?: string;
    updateTime?: string;
  }> = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ pageSize: '50', ignoreRatingOnlyReviews: 'true' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await googleJson<{ reviews?: typeof reviews; nextPageToken?: string }>(
      `${MY_BUSINESS_URL}/${meta.locationName}/reviews?${query.toString()}`,
      { method: 'GET' },
      platform,
    );
    reviews.push(...(response.reviews ?? []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  let upserted = 0;
  let skipped = 0;
  for (const review of reviews) {
    const externalReviewId = review.name;
    const reviewText = review.comment?.trim();
    if (!externalReviewId || !reviewText) {
      skipped += 1;
      continue;
    }
    const rating = RATING_MAP[review.starRating ?? ''] ?? 0;
    if (!rating) {
      skipped += 1;
      continue;
    }
    const reviewDateValue = review.updateTime ?? review.createTime;
    const reviewDate = reviewDateValue ? new Date(reviewDateValue) : null;
    await db.insert(googleReviews).values({
      externalReviewId,
      source: 'google_business',
      locationResourceName: meta.locationName,
      reviewerName: review.reviewer?.displayName?.trim() || 'Google kullanıcısı',
      reviewText,
      rating,
      reviewLanguage: 'und',
      reviewDate: reviewDate && !Number.isNaN(reviewDate.getTime()) ? reviewDate : null,
      isVisible: true,
      googleSourceIndicator: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: googleReviews.externalReviewId,
      set: {
        reviewerName: review.reviewer?.displayName?.trim() || 'Google kullanıcısı',
        reviewText,
        rating,
        reviewDate: reviewDate && !Number.isNaN(reviewDate.getTime()) ? reviewDate : null,
        locationResourceName: meta.locationName,
        source: 'google_business',
        googleSourceIndicator: true,
        updatedAt: new Date(),
      },
    });
    upserted += 1;
  }

  const syncedAt = new Date();
  await db.update(socialPlatforms).set({
    connectionMeta: {
      ...meta,
      lastReviewSyncAt: syncedAt.toISOString(),
      lastReviewSyncCount: upserted,
      reviewSyncStatus: options.source ?? 'manual',
      // External schedulers call once per hour. This is status information for
      // admins, not a second in-process scheduler that could duplicate work.
      nextReviewSyncAt: new Date(syncedAt.getTime() + 60 * 60 * 1_000).toISOString(),
    },
    lastError: null,
    updatedAt: syncedAt,
  }).where(and(eq(socialPlatforms.key, GOOGLE_BUSINESS_KEY), eq(socialPlatforms.connected, true)));

  return { received: reviews.length, upserted, skipped, syncedAt: syncedAt.toISOString() };
}