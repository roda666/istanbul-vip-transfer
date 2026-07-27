/**
 * Environment variable helpers.
 * Call assertEnv() at module load time in server-side code to surface
 * missing secrets early and clearly.
 */

/**
 * Asserts that a required environment variable is present and non-empty.
 * Throws a descriptive error if it is missing.
 */
export function assertEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Required environment variable "${key}" is not set.\n` +
        `Add it to Replit Secrets, then restart the server.\n` +
        `See ADMIN_SETUP.md for setup instructions.`,
    );
  }
  return value;
}

/**
 * Returns true if all required admin environment variables are present.
 * Used to surface configuration warnings in the admin UI.
 */
export function adminEnvReady(): { ok: boolean; missing: string[] } {
  const required = ['DATABASE_URL', 'AUTH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}
