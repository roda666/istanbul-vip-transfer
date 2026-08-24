/**
 * Envelope encryption dedicated to the SMTP password managed in the admin UI.
 *
 * On first use the app creates a random AES-256 data key. The database stores
 * only that key encrypted with a wrapping key derived from an existing
 * Replit-managed application secret (AUTH_SECRET or SESSION_SECRET). This keeps
 * the owner out of Secrets while ensuring a database export alone cannot reveal
 * the SMTP password.
 *
 * Existing EMAIL_ENCRYPTION_KEY values remain supported so installations with
 * already-encrypted SMTP passwords continue to work without migration.
 */
import 'server-only';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

let managedDataKeyPromise: Promise<Buffer | null> | null = null;

function readLegacyKey(): Buffer | null {
  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) return null;
  const key = Buffer.from(hex, 'hex');
  return key.length === 32 ? key : null;
}

function getWrappingKey(): Buffer | null {
  const rootSecret = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!rootSecret) return null;
  return crypto
    .createHmac('sha256', rootSecret)
    .update('istanbul-vip-transfer:smtp-password-key-wrap:v1')
    .digest();
}

function seal(value: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function open(value: string, key: Buffer): Buffer | null {
  try {
    const parts = value.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, ciphertextB64] = parts as [string, string, string];
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

async function loadOrCreateManagedDataKey(): Promise<Buffer | null> {
  const wrappingKey = getWrappingKey();
  if (!wrappingKey) return null;

  try {
    const { db } = await import('@/db');
    const { emailEncryptionKeys } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [existing] = await db
      .select({ wrappedKey: emailEncryptionKeys.wrappedKey })
      .from(emailEncryptionKeys)
      .where(eq(emailEncryptionKeys.id, 1))
      .limit(1);

    if (existing) {
      const key = open(existing.wrappedKey, wrappingKey);
      return key?.length === 32 ? key : null;
    }

    const generatedKey = crypto.randomBytes(32);
    await db
      .insert(emailEncryptionKeys)
      .values({ id: 1, wrappedKey: seal(generatedKey, wrappingKey), updatedAt: new Date() })
      .onConflictDoNothing();

    // Another process may have won the initial insert; always re-read the
    // persisted value before returning so every process uses the same key.
    const [stored] = await db
      .select({ wrappedKey: emailEncryptionKeys.wrappedKey })
      .from(emailEncryptionKeys)
      .where(eq(emailEncryptionKeys.id, 1))
      .limit(1);
    const key = stored ? open(stored.wrappedKey, wrappingKey) : null;
    return key?.length === 32 ? key : null;
  } catch {
    return null;
  }
}

async function getDataKey(): Promise<Buffer | null> {
  const legacyKey = readLegacyKey();
  if (legacyKey) return legacyKey;

  if (!managedDataKeyPromise) {
    managedDataKeyPromise = loadOrCreateManagedDataKey();
  }
  const key = await managedDataKeyPromise;
  if (!key) managedDataKeyPromise = null;
  return key;
}

/** Ensures a managed SMTP encryption key exists without exposing it. */
export async function ensureSmtpPasswordEncryption(): Promise<boolean> {
  return (await getDataKey()) !== null;
}

/** Encrypts an SMTP password using the managed random data key. */
export async function encryptSmtpPassword(plaintext: string): Promise<string | null> {
  const key = await getDataKey();
  return key ? seal(Buffer.from(plaintext, 'utf8'), key) : null;
}

/** Decrypts an SMTP password. Invalid or legacy-unreadable data returns null. */
export async function decryptSmtpPassword(ciphertext: string): Promise<string | null> {
  const key = await getDataKey();
  if (!key) return null;
  const plaintext = open(ciphertext, key);
  return plaintext ? plaintext.toString('utf8') : null;
}