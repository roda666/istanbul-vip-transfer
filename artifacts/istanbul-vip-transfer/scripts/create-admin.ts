/**
 * First-admin creation script.
 * Run: pnpm create-admin
 *
 * Reads env vars:
 *   ADMIN_EMAIL    — email address for the new admin
 *   ADMIN_PASSWORD — plaintext password (remove from env after use!)
 *   ADMIN_NAME     — optional display name (defaults to "Admin")
 *
 * Creates the admin only if NO admin users exist yet.
 * Never logs the password or its hash.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { adminUsers } from '../db/schema';
import { count } from 'drizzle-orm';
import { hashPassword } from '../lib/auth/password';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌  DATABASE_URL ortam değişkeni bulunamadı.');
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  if (!email) {
    console.error('❌  ADMIN_EMAIL ortam değişkeni gereklidir.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('❌  ADMIN_PASSWORD ortam değişkeni gereklidir (min 8 karakter).');
    process.exit(1);
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    // Check if any admin exists
    const [{ count: existing }] = await db.select({ count: count() }).from(adminUsers);
    if (existing > 0) {
      console.log(`ℹ️  Zaten ${existing} admin kullanıcısı mevcut. Yeni kullanıcı oluşturulmadı.`);
      console.log('   Ek admin eklemek için veritabanına doğrudan INSERT yapın.');
      await client.end();
      process.exit(0);
    }

    console.log(`📧  Admin oluşturuluyor: ${email}`);
    const passwordHash = await hashPassword(password);

    const [newAdmin] = await db
      .insert(adminUsers)
      .values({ email, name, passwordHash, role: 'SUPER_ADMIN' })
      .returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role });

    console.log('✅  Admin başarıyla oluşturuldu:');
    console.log(`   ID:    ${newAdmin.id}`);
    console.log(`   E-posta: ${newAdmin.email}`);
    console.log(`   Ad:    ${newAdmin.name}`);
    console.log(`   Rol:   ${newAdmin.role}`);
    console.log('');
    console.log('⚠️  GÜVENLİK UYARISI: ADMIN_PASSWORD ortam değişkenini hemen kaldırın!');
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      console.error(`❌  "${email}" adresi zaten kayıtlı.`);
    } else {
      console.error('❌  Admin oluşturulurken hata:', err instanceof Error ? err.message : err);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
