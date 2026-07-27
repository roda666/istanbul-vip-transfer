/**
 * Password hashing utilities using bcryptjs.
 * bcryptjs is pure JavaScript (no native bindings) for maximum portability.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * Never log the input or output.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
