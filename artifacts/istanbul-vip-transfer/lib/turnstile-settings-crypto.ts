/**
 * Envelope encryption dedicated to the Cloudflare Turnstile secret.
 *
 * The secret is encrypted with an application-generated AES-256 data key.
 * That data key is itself encrypted with a key derived from AUTH_SECRET or
 * SESSION_SECRET, so a database export alone cannot reveal the secret.
 */
import 'server-only';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

type EncryptionIssue =
  | 'root_key_unavailable'
  | 'secure_key_storage_unavailable'
  | 'stored_key_invalid';

type ManagedDataKeyResult = {
  key: Buffer | null;
  issue: EncryptionIssue | null;
};

export type TurnstileEncryptionStatus = {
  ready: boolean;
  issue: EncryptionIssue | null;
};

let managedDataKeyPromise: Promise<ManagedDataKeyResult> | null = null;

function getWrappingKey(): Buffer | null {
  // A deployment normally has AUTH_SECRET. SESSION_SECRET preserves the
  // existing fallback, while EMAIL_ENCRYPTION_KEY is an independent managed
  // secret for environments where the auth secret has not yet been supplied.
  // The purpose-specific HMAC label ensures this does not share an encryption
  // key with SMTP credentials.
  const rootSecret = process.env.AUTH_SECRET
    ?? process.env.SESSION_SECRET
    ?? process.env.EMAIL_ENCRYPTION_KEY;
  if (!rootSecret) return null;
  return crypto
    .createHmac('sha256', rootSecret)
    .update('istanbul-vip-transfer:turnstile-secret-key-wrap:v1')
    .digest();
}

function seal(value: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function open(value: string, key: Buffer): Buffer | null {
  try {
    const [ivB64, tagB64, ciphertextB64, ...extra] = value.split(':');
    if (!ivB64 || !tagB64 || !ciphertextB64 || extra.length > 0) return null;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

async function loadOrCreateManagedDataKey(): Promise<ManagedDataKeyResult> {
  const wrappingKey = getWrappingKey();
  if (!wrappingKey) return { key: null, issue: 'root_key_unavailable' };

  try {
    const { db } = await import('@/db');
    const { turnstileEncryptionKeys } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [existing] = await db
      .select({ wrappedKey: turnstileEncryptionKeys.wrappedKey })
      .from(turnstileEncryptionKeys)
      .where(eq(turnstileEncryptionKeys.id, 1))
      .limit(1);

    if (existing) {
      const key = open(existing.wrappedKey, wrappingKey);
      return key?.length === 32
        ? { key, issue: null }
        : { key: null, issue: 'stored_key_invalid' };
    }

    const generatedKey = crypto.randomBytes(32);
    await db.insert(turnstileEncryptionKeys)
      .values({ id: 1, wrappedKey: seal(generatedKey, wrappingKey), updatedAt: new Date() })
      .onConflictDoNothing();

    const [stored] = await db
      .select({ wrappedKey: turnstileEncryptionKeys.wrappedKey })
      .from(turnstileEncryptionKeys)
      .where(eq(turnstileEncryptionKeys.id, 1))
      .limit(1);
    const key = stored ? open(stored.wrappedKey, wrappingKey) : null;
    return key?.length === 32
      ? { key, issue: null }
      : { key: null, issue: stored ? 'stored_key_invalid' : 'secure_key_storage_unavailable' };
  } catch {
    return { key: null, issue: 'secure_key_storage_unavailable' };
  }
}

async function getDataKey(): Promise<ManagedDataKeyResult> {
  if (!managedDataKeyPromise) managedDataKeyPromise = loadOrCreateManagedDataKey();
  const result = await managedDataKeyPromise;
  if (!result.key) managedDataKeyPromise = null;
  return result;
}

export async function getTurnstileEncryptionStatus(): Promise<TurnstileEncryptionStatus> {
  const { key, issue } = await getDataKey();
  return { ready: key !== null, issue };
}

export async function ensureTurnstileSecretEncryption(): Promise<boolean> {
  return (await getTurnstileEncryptionStatus()).ready;
}

export async function encryptTurnstileSecret(plaintext: string): Promise<string | null> {
  const { key } = await getDataKey();
  if (!key) return null;
  const ciphertext = seal(Buffer.from(plaintext, 'utf8'), key);
  return open(ciphertext, key)?.toString('utf8') === plaintext ? ciphertext : null;
}

export async function decryptTurnstileSecret(ciphertext: string): Promise<string | null> {
  const { key } = await getDataKey();
  if (!key) return null;
  const plaintext = open(ciphertext, key);
  return plaintext ? plaintext.toString('utf8') : null;
}