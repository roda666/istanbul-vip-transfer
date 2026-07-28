/**
 * Idempotent seed: insert 5 languages (tr as default, en/de/ru/ar as enabled targets).
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage: pnpm --filter @workspace/istanbul-vip-transfer tsx db/seed-languages.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

const LANGUAGES = [
  {
    code: 'tr',
    locale: 'tr-TR',
    name: 'Turkish',
    nativeName: 'Türkçe',
    direction: 'ltr' as const,
    isDefault: true,
    isEnabled: true,
    displayOrder: 0,
  },
  {
    code: 'en',
    locale: 'en-GB',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr' as const,
    isDefault: false,
    isEnabled: true,
    displayOrder: 1,
  },
  {
    code: 'de',
    locale: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr' as const,
    isDefault: false,
    isEnabled: true,
    displayOrder: 2,
  },
  {
    code: 'ru',
    locale: 'ru-RU',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr' as const,
    isDefault: false,
    isEnabled: true,
    displayOrder: 3,
  },
  {
    code: 'ar',
    locale: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl' as const,
    isDefault: false,
    isEnabled: true,
    displayOrder: 4,
  },
] satisfies (typeof schema.languages.$inferInsert)[];

async function seed() {
  console.log('Seeding languages...');
  for (const lang of LANGUAGES) {
    await db
      .insert(schema.languages)
      .values(lang)
      .onConflictDoUpdate({
        target: schema.languages.code,
        set: {
          locale: sql`EXCLUDED.locale`,
          name: sql`EXCLUDED.name`,
          nativeName: sql`EXCLUDED.native_name`,
          direction: sql`EXCLUDED.direction`,
          isDefault: sql`EXCLUDED.is_default`,
          displayOrder: sql`EXCLUDED.display_order`,
          updatedAt: sql`now()`,
        },
      });
    console.log(`  ✓ ${lang.code} (${lang.nativeName})`);
  }
  console.log('Languages seeded successfully.');
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
