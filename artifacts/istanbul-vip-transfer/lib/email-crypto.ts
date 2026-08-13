/**
 * AES-256-GCM encryption/decryption for SMTP passwords stored in the database.
 *
 * Requires the EMAIL_ENCRYPTION_KEY environment variable — a 64-character hex
 * string representing 32 bytes.  Generate one with:
 *   openssl rand -hex 32
 * Then add it to Replit Secrets as EMAIL_ENCRYPTION_KEY.
 *
 * If the key is missing or malformed, isEncryptionReady() returns false and
 * encrypt/decrypt return null.  The caller is responsible for surfacing a
 * clear setup warning in the UI and refusing to store passwords without a key.
 *
 * Ciphertext format (single text column):
 *   base64(iv):base64(authTag):base64(ciphertext)
 * where iv is 12 random bytes, authTag is 16 bytes (GCM default).
 */
import 'server-only';
import crypto from 'crypto';

const ALGO     = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer | null {
  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  try {
    const buf = Buffer.from(hex, 'hex');
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

/** Returns true if EMAIL_ENCRYPTION_KEY is present and valid. */
export function isEncryptionReady(): boolean {
  return getKey() !== null;
}

/**
 * Encrypts a plaintext string.
 * Returns null if the key is not available — do NOT store the password in that case.
 */
export function encrypt(plaintext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv       = crypto.randomBytes(IV_BYTES);
  const cipher   = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag      = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts an encoded string produced by encrypt().
 * Returns null on any error (key missing, tampered data, wrong format).
 * Never throws.
 */
export function decrypt(encoded: string): string | null {
  const key = getKey();
  if (!key) return null;
  try {
    const parts = encoded.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, cipherB64] = parts as [string, string, string];
    const iv         = Buffer.from(ivB64,    'base64');
    const tag        = Buffer.from(tagB64,   'base64');
    const ciphertext = Buffer.from(cipherB64,'base64');
    const decipher   = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null; // tampered, wrong key, or bad format
  }
}
