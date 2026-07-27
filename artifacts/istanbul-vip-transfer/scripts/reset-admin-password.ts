/**
 * Secure admin password reset script.
 * Run: pnpm reset-admin-password
 *
 * Reads env vars:
 *   ADMIN_EMAIL        — email of the existing admin account
 *   ADMIN_NEW_PASSWORD — replacement plaintext password (remove after use)
 *
 * Updates exactly one existing account. Never prints the password or hash.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { adminUsers } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../lib/auth/password';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌  DATABASE_URL not set.');
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!email) {
    console.error('❌  ADMIN_EMAIL not set.');
    process.exit(1);
  }
  if (!newPassword || newPassword.length < 8) {
    console.error('❌  ADMIN_NEW_PASSWORD not set or too short (min 8 chars).');
    process.exit(1);
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    // Find the existing account by email
    const rows = await db
      .select({ id: adminUsers.id, active: adminUsers.active })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (rows.length === 0) {
      console.error('❌  No admin account found for that email.');
      process.exit(1);
    }

    const existing = rows[0];
    const newHash = await hashPassword(newPassword);

    // Update password and ensure account is active
    await db
      .update(adminUsers)
      .set({ passwordHash: newHash, active: true })
      .where(eq(adminUsers.id, existing.id));

    console.log('✅  Password reset successfully.');
    console.log('   Account active: true');
    console.log('⚠️  Remove ADMIN_NEW_PASSWORD from Replit Secrets now.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
