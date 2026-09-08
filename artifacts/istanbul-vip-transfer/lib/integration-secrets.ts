import 'server-only';
import { decryptIntegrationSecret } from './integration-secrets-crypto';

export const EDITABLE_INTEGRATION_KEYS = [
  'GOOGLE_MAPS_API_KEY', 'OPENAI_API_KEY', 'AI_INTEGRATIONS_OPENAI_API_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'META_APP_ID',
  'META_APP_SECRET', 'META_LOGIN_CONFIG_ID', 'X_CONSUMER_KEY', 'X_CONSUMER_SECRET',
  'X_OAUTH2_CLIENT_ID',
  'CRON_SECRET', 'TOLL_SYNC_TOKEN_SECRET',
] as const;
export type EditableIntegrationKey = typeof EDITABLE_INTEGRATION_KEYS[number];
export const MANAGED_INTEGRATION_KEYS = [...EDITABLE_INTEGRATION_KEYS, 'SMTP_PASS', 'TURNSTILE_SECRET'] as const;
export type ManagedIntegrationKey = typeof MANAGED_INTEGRATION_KEYS[number];
export const ENVIRONMENT_ONLY_INTEGRATION_KEYS = [
  'AI_INTEGRATIONS_OPENAI_BASE_URL', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'X_BEARER_TOKEN',
] as const;
export type EnvironmentOnlyIntegrationKey = typeof ENVIRONMENT_ONLY_INTEGRATION_KEYS[number];
export const PROTECTED_INTEGRATION_KEYS = ['AUTH_SECRET', 'SESSION_SECRET', 'NEXTAUTH_SECRET', 'EMAIL_ENCRYPTION_KEY', 'DATABASE_URL'] as const;
const editableSet = new Set<string>(EDITABLE_INTEGRATION_KEYS);
export function isEditableIntegrationKey(key: unknown): key is EditableIntegrationKey {
  return typeof key === 'string' && editableSet.has(key);
}
export function isManagedIntegrationKey(key: unknown): key is ManagedIntegrationKey {
  return typeof key === 'string' && (MANAGED_INTEGRATION_KEYS as readonly string[]).includes(key);
}
export function resolveEnvironmentOnlyIntegrationConfig(key: EnvironmentOnlyIntegrationKey): string | undefined {
  return process.env[key];
}
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}
const entries: Array<{ key: EditableIntegrationKey; label: string; purpose: string }> = [
  ['GOOGLE_MAPS_API_KEY', 'Google Haritalar API anahtarı', 'Rota mesafesi hesaplama'], ['OPENAI_API_KEY', 'OpenAI API anahtarı', 'AI içerik ve çeviri'], ['AI_INTEGRATIONS_OPENAI_API_KEY', 'Replit AI OpenAI anahtarı', 'AI proxy kimlik doğrulaması'], ['GOOGLE_CLIENT_ID', 'Google OAuth istemci kimliği', 'GSC, Ads ve İşletme bağlantısı'], ['GOOGLE_CLIENT_SECRET', 'Google OAuth istemci sırrı', 'Google token yenileme'], ['GOOGLE_ADS_DEVELOPER_TOKEN', 'Google Ads geliştirici anahtarı', 'Keyword Planner erişimi'], ['GOOGLE_ADS_LOGIN_CUSTOMER_ID', 'Google Ads yönetici müşteri kimliği', 'Keyword Planner hesap bağlamı'], ['META_APP_ID', 'Meta uygulama kimliği', 'Facebook ve Instagram OAuth'], ['META_APP_SECRET', 'Meta uygulama sırrı', 'Facebook ve Instagram OAuth'], ['META_LOGIN_CONFIG_ID', 'Meta giriş yapılandırma kimliği', 'Meta OAuth yapılandırması'], ['X_CONSUMER_KEY', 'X tüketici anahtarı', 'X OAuth 1.0a'], ['X_CONSUMER_SECRET', 'X tüketici sırrı', 'X OAuth 1.0a'], ['X_OAUTH2_CLIENT_ID', 'X OAuth 2 istemci kimliği', 'X OAuth 2 yapılandırması'], ['CRON_SECRET', 'Zamanlanmış görev anahtarı', 'Cron uç noktası doğrulaması'], ['TOLL_SYNC_TOKEN_SECRET', 'Tarife senkron anahtarı', 'Tarife önizleme imzası'],
].map(([key, label, purpose]) => ({ key: key as EditableIntegrationKey, label, purpose }));
export const INTEGRATION_CATALOG = [
  ...entries.map(entry => ({ ...entry, editable: true })),
  { key: 'AI_INTEGRATIONS_OPENAI_BASE_URL', editable: false, label: 'Replit AI proxy adresi', purpose: 'Güvenilir altyapı uç noktası; yalnızca ortam değişkeni' },
  { key: 'X_ACCESS_TOKEN', editable: false, label: 'X erişim anahtarı', purpose: 'Yalnızca mevcut X bağlantısının ortam fallback’i; değer gösterilmez' },
  { key: 'X_ACCESS_TOKEN_SECRET', editable: false, label: 'X erişim anahtarı sırrı', purpose: 'Yalnızca mevcut X bağlantısının ortam fallback’i; değer gösterilmez' },
  { key: 'X_BEARER_TOKEN', editable: false, label: 'X Bearer anahtarı', purpose: 'Yalnızca ortamda kullanılan X uygulama anahtarı; değer gösterilmez' },
  { key: 'AUTH_SECRET', editable: false, label: 'Oturum imzalama kök anahtarı', purpose: 'Admin oturumları ve şifreleme anahtarları; yalnızca Replit Secrets üzerinden yönetilir' },
  { key: 'SESSION_SECRET', editable: false, label: 'Yedek oturum kök anahtarı', purpose: 'Oturum ve şifreleme için güvenli fallback; yalnızca Replit Secrets üzerinden yönetilir' },
  { key: 'NEXTAUTH_SECRET', editable: false, label: 'Eski NextAuth anahtarı', purpose: 'Geriye uyumlu imza fallback’i; yalnızca Replit Secrets üzerinden yönetilir' },
  { key: 'EMAIL_ENCRYPTION_KEY', editable: false, label: 'Eski e-posta şifreleme anahtarı', purpose: 'Eski şifreli SMTP kayıtlarını açabilmek için yalnızca Replit Secrets üzerinden yönetilir' },
  { key: 'DATABASE_URL', editable: false, label: 'Veritabanı bağlantı sırrı', purpose: 'Uygulamanın PostgreSQL bağlantısı; runtime tarafından yönetilir' },
  { key: 'SMTP_PASS', editable: true, label: 'SMTP parolası', purpose: 'E-posta gönderim kimlik doğrulaması' },
  { key: 'TURNSTILE_SECRET', editable: true, label: 'Turnstile gizli anahtarı', purpose: 'Form bot doğrulaması' },
  { key: 'GSC_CONNECTION', editable: false, label: 'Google Search Console bağlantısı', purpose: 'Mevcut OAuth bağlantı durumu; erişim belirteci gösterilmez' },
  { key: 'GOOGLE_BUSINESS_CONNECTION', editable: false, label: 'Google İşletme Profili bağlantısı', purpose: 'Mevcut OAuth bağlantı durumu; erişim belirteci gösterilmez' },
  { key: 'META_CONNECTION', editable: false, label: 'Meta sosyal medya bağlantısı', purpose: 'Facebook/Instagram OAuth durumu; erişim belirteci gösterilmez' },
  { key: 'X_CONNECTION', editable: false, label: 'X bağlantısı', purpose: 'X OAuth bağlantı durumu; erişim belirteci gösterilmez' },
  { key: 'GOOGLE_ADS_CONNECTION', editable: false, label: 'Google Ads bağlantısı', purpose: 'Mevcut OAuth bağlantı durumu; erişim belirteci gösterilmez' },
  { key: 'WHATSAPP', editable: false, label: 'WhatsApp', purpose: 'API kimlik bilgisi yok; numara Site Ayarlarında yönetilir' },
] as const;

/** DB first for central, allowlisted application credentials, then environment fallback. */
export async function resolveIntegrationSecretWithReader(
  key: EditableIntegrationKey,
  readCiphertext: (key: EditableIntegrationKey) => Promise<string | null | undefined>,
  env: Record<string, string | undefined> = process.env,
  decrypt: (ciphertext: string) => Promise<string | null> = decryptIntegrationSecret,
): Promise<string | undefined> {
  try {
    const ciphertext = await readCiphertext(key);
    if (ciphertext) {
      const value = await decrypt(ciphertext);
      if (value) return value;
      // A stored but undecryptable central secret fails closed rather than
      // unexpectedly switching to an old environment credential.
      return undefined;
    }
  } catch {
    // An unavailable DB retains deployment env fallback for runtime continuity.
  }
  return env[key];
}

export async function resolveIntegrationSecret(key: EditableIntegrationKey): Promise<string | undefined> {
  return resolveIntegrationSecretWithReader(key, async (requestedKey) => {
    const { db } = await import('@/db');
    const { integrationSecrets } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [stored] = await db.select({ ciphertext: integrationSecrets.ciphertext }).from(integrationSecrets).where(eq(integrationSecrets.key, requestedKey)).limit(1);
    return stored?.ciphertext;
  });
}