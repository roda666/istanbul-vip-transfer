import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { socialPlatforms } from '@/db/schema';

export const SOCIAL_PLATFORM_KEYS = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'tiktok',
  'youtube',
  'google_business',
  'telegram',
] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORM_KEYS)[number];

export type SocialPlatformDefinition = {
  key: SocialPlatformKey;
  name: string;
  authType: 'meta_oauth' | 'x_oauth1' | 'google_oauth' | 'future';
  requiredSecrets: string[];
  canConnect: boolean;
  description: string;
};

export const SOCIAL_PLATFORM_CATALOG: SocialPlatformDefinition[] = [
  {
    key: 'facebook',
    name: 'Facebook',
    authType: 'meta_oauth',
    requiredSecrets: ['META_APP_ID', 'META_APP_SECRET'],
    canConnect: true,
    description: 'Meta OAuth ile Facebook Sayfası gönderileri.',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    authType: 'meta_oauth',
    requiredSecrets: ['META_APP_ID', 'META_APP_SECRET'],
    canConnect: true,
    description: 'Meta OAuth ile profesyonel Instagram hesabı yayınları.',
  },
  {
    key: 'x',
    name: 'X / Twitter',
    authType: 'x_oauth1',
    requiredSecrets: ['X_CONSUMER_KEY', 'X_CONSUMER_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'],
    canConnect: true,
    description: 'X API v2 ile OAuth 1.0a User Context tweet paylaşımı.',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    authType: 'future',
    requiredSecrets: [],
    canConnect: false,
    description: 'LinkedIn şirket sayfası paylaşımı için hazır.',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    authType: 'future',
    requiredSecrets: [],
    canConnect: false,
    description: 'TikTok Business paylaşımı için hazır.',
  },
  {
    key: 'youtube',
    name: 'YouTube',
    authType: 'future',
    requiredSecrets: [],
    canConnect: false,
    description: 'YouTube ve Shorts paylaşımı için hazır.',
  },
  {
    key: 'google_business',
    name: 'Google Business Profile',
    authType: 'google_oauth',
    requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    canConnect: true,
    description: 'Google Posts yayınları ve gerçek müşteri yorumlarının güvenli senkronizasyonu.',
  },
  {
    key: 'telegram',
    name: 'Telegram',
    authType: 'future',
    requiredSecrets: [],
    canConnect: false,
    description: 'Telegram bot ve kanal paylaşımı için hazır.',
  },
];

function xEnvironmentReady() {
  return Boolean(
    process.env.X_CONSUMER_KEY &&
    process.env.X_CONSUMER_SECRET &&
    process.env.X_ACCESS_TOKEN &&
    process.env.X_ACCESS_TOKEN_SECRET,
  );
}

export async function ensureSocialPlatforms() {
  await db.insert(socialPlatforms)
    .values(SOCIAL_PLATFORM_CATALOG.map((platform) => ({
      key: platform.key,
      name: platform.name,
      authType: platform.authType,
      requiredSecrets: platform.requiredSecrets,
    })))
    .onConflictDoNothing();

  // X may be configured through Replit Secrets before a browser OAuth flow is
  // used. Persist its connection state so toggles remain DB-backed.
  if (xEnvironmentReady()) {
    const [xPlatform] = await db.select({
      lastError: socialPlatforms.lastError,
    }).from(socialPlatforms).where(eq(socialPlatforms.key, 'x')).limit(1);

    // A failed live API check must remain visible; otherwise each page refresh
    // would hide an invalid/revoked credential by marking it connected again.
    if (xPlatform?.lastError) {
      await db.update(socialPlatforms)
        .set({ connected: false, enabled: false, updatedAt: new Date() })
        .where(eq(socialPlatforms.key, 'x'));
    } else {
      await db.update(socialPlatforms)
        .set({
          connected: true,
          connectionMeta: { source: 'replit_secrets' },
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialPlatforms.key, 'x'));
    }
  }
}

export async function getSocialPlatforms() {
  await ensureSocialPlatforms();
  const rows = await db.select().from(socialPlatforms);

  return SOCIAL_PLATFORM_CATALOG.map((definition) => {
    const row = rows.find((item) => item.key === definition.key);
    const connected = Boolean(row?.connected);

    return {
      key: definition.key,
      name: definition.name,
      authType: definition.authType,
      requiredSecrets: definition.requiredSecrets,
      canConnect: definition.canConnect,
      description: definition.description,
      connected,
      enabled: connected && Boolean(row?.enabled),
      connectionMeta: row?.connectionMeta ?? {},
      lastPublishUrl: row?.lastPublishUrl ?? null,
      lastError: row?.lastError ?? null,
    };
  });
}

export function isSocialPlatformKey(value: string): value is SocialPlatformKey {
  return SOCIAL_PLATFORM_KEYS.includes(value as SocialPlatformKey);
}

export async function setSocialPlatformEnabled(key: SocialPlatformKey, enabled: boolean) {
  await ensureSocialPlatforms();
  const [platform] = await db.select().from(socialPlatforms)
    .where(eq(socialPlatforms.key, key))
    .limit(1);

  if (!platform) throw new Error('Platform bulunamadı.');
  if (enabled && !platform.connected) throw new Error('Önce platform bağlantısı tamamlanmalı.');
  if (enabled && key === 'google_business') {
    const meta = platform.connectionMeta as { accountName?: unknown; locationName?: unknown };
    if (typeof meta.accountName !== 'string' || typeof meta.locationName !== 'string') {
      throw new Error('Google Business Profile için önce hesap ve işletme konumu seçilmeli.');
    }
  }

  const [updated] = await db.update(socialPlatforms)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(socialPlatforms.key, key))
    .returning();

  return updated;
}