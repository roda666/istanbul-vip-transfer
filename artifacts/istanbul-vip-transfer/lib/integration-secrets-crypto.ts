/**
 * Envelope encryption for centrally managed integration credentials. The
 * database contains ciphertext and a wrapped random data key only; AUTH_SECRET
 * or SESSION_SECRET remains outside the database and is never editable here.
 */
import 'server-only';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
let dataKeyPromise: Promise<Buffer | null> | null = null;

function wrappingKey(): Buffer | null {
  const root = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  return root ? crypto.createHmac('sha256', root).update('istanbul-vip-transfer:integration-secrets-key-wrap:v1').digest() : null;
}

export function sealIntegrationSecret(value: Buffer, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

export function openIntegrationSecret(value: string, key: Buffer): Buffer | null {
  try {
    const [iv64, tag64, text64, ...extra] = value.split(':');
    if (!iv64 || !tag64 || !text64 || extra.length) return null;
    const decode = (input: string): Buffer | null => {
      // Buffer accepts malformed/trailing base64; canonical validation makes
      // any serialized ciphertext modification an authentication failure.
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return null;
      const decoded = Buffer.from(input, 'base64');
      return decoded.toString('base64') === input ? decoded : null;
    };
    const iv = decode(iv64), tag = decode(tag64), ciphertext = decode(text64);
    if (!iv || !tag || !ciphertext) return null;
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || !ciphertext.length) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch { return null; }
}

async function loadKey(): Promise<Buffer | null> {
  const wrap = wrappingKey();
  if (!wrap) return null;
  try {
    const { db } = await import('@/db');
    const { integrationSecretsEncryptionKeys } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [existing] = await db.select({ wrappedKey: integrationSecretsEncryptionKeys.wrappedKey }).from(integrationSecretsEncryptionKeys).where(eq(integrationSecretsEncryptionKeys.id, 1)).limit(1);
    if (existing) {
      const key = openIntegrationSecret(existing.wrappedKey, wrap);
      return key?.length === 32 ? key : null;
    }
    const generated = crypto.randomBytes(32);
    await db.insert(integrationSecretsEncryptionKeys).values({ id: 1, wrappedKey: sealIntegrationSecret(generated, wrap), updatedAt: new Date() }).onConflictDoNothing();
    const [stored] = await db.select({ wrappedKey: integrationSecretsEncryptionKeys.wrappedKey }).from(integrationSecretsEncryptionKeys).where(eq(integrationSecretsEncryptionKeys.id, 1)).limit(1);
    const key = stored ? openIntegrationSecret(stored.wrappedKey, wrap) : null;
    return key?.length === 32 ? key : null;
  } catch { return null; }
}

async function key(): Promise<Buffer | null> {
  if (!dataKeyPromise) dataKeyPromise = loadKey();
  const result = await dataKeyPromise;
  if (!result) dataKeyPromise = null;
  return result;
}

export async function encryptIntegrationSecret(plaintext: string): Promise<string | null> {
  const dataKey = await key();
  if (!dataKey) return null;
  const ciphertext = sealIntegrationSecret(Buffer.from(plaintext, 'utf8'), dataKey);
  return openIntegrationSecret(ciphertext, dataKey)?.toString('utf8') === plaintext ? ciphertext : null;
}

export async function decryptIntegrationSecret(ciphertext: string): Promise<string | null> {
  const dataKey = await key();
  return dataKey ? openIntegrationSecret(ciphertext, dataKey)?.toString('utf8') ?? null : null;
}