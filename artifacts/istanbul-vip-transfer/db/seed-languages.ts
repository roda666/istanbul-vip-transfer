/**
 * Idempotent language-catalog seed.
 *
 * - First run (bootstrap): core 9 inserted active+published (tr default), every
 *   other catalog language inserted PASSIVE (isEnabled=false, isPublished=false).
 * - Re-runs never duplicate rows and NEVER flip isEnabled/isPublished/isDefault
 *   on existing rows — admin-managed visibility state survives re-seeding; only
 *   catalog metadata (names, script, locale, direction, order) is refreshed.
 *   Sole exception: TR is re-asserted as default+enabled+published (source-language
 *   invariant that must hold regardless of any state drift).
 *
 * Usage: pnpm --filter @workspace/istanbul-vip-transfer tsx db/seed-languages.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { LANGUAGE_CATALOG, CORE_LANGS } from './language-catalog';

/**
 * Languages with complete static UI dictionaries that may be publicly published.
 * Task #103 shipped es/fr/it/nl dictionaries, so every enabled language is now
 * also published on bootstrap.  PUBLISHED_LANGS === CORE_LANGS (all 9).
 */
const PUBLISHED_LANGS = CORE_LANGS;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log(`Seeding ${LANGUAGE_CATALOG.length} catalog languages (${CORE_LANGS.length} enabled, ${PUBLISHED_LANGS.length} published)...`);
  let inserted = 0;
  let updated = 0;

  for (const [i, lang] of LANGUAGE_CATALOG.entries()) {
    const isCore = (CORE_LANGS as readonly string[]).includes(lang.code);
    const values: typeof schema.languages.$inferInsert = {
      code: lang.code,
      locale: lang.locale,
      name: lang.name,
      nativeName: lang.nativeName,
      turkishName: lang.turkishName,
      script: lang.script,
      direction: lang.direction,
      providerSupported: lang.providerSupported ?? true,
      isDefault: lang.code === 'tr',
      isEnabled: isCore, // all 9 registry languages are enabled
      isPublished: (PUBLISHED_LANGS as readonly string[]).includes(lang.code), // only dictionary-backed 5
      displayOrder: i,
    };

    const res = await db
      .insert(schema.languages)
      .values(values)
      .onConflictDoUpdate({
        target: schema.languages.code,
        set: {
          // Refresh catalog metadata only — never touch isEnabled/isPublished/isDefault
          // for existing rows (admin-controlled state must survive re-seeding)...
          locale: sql`EXCLUDED.locale`,
          name: sql`EXCLUDED.name`,
          nativeName: sql`EXCLUDED.native_name`,
          turkishName: sql`EXCLUDED.turkish_name`,
          script: sql`EXCLUDED.script`,
          direction: sql`EXCLUDED.direction`,
          providerSupported: sql`EXCLUDED.provider_supported`,
          displayOrder: sql`EXCLUDED.display_order`,
          updatedAt: sql`now()`,
          // ...sole exception: TR must always remain default+active+published.
          // en/de/ru/ar keep whatever state the admin last set (disable/unpublish
          // actions survive re-seeding).
          ...(lang.code === 'tr'
            ? {
                isDefault: sql`true`,
                isEnabled: sql`true`,
                isPublished: sql`true`,
              }
            : {}),
        },
      })
      .returning({ createdAt: schema.languages.createdAt, updatedAt: schema.languages.updatedAt });

    if (res[0] && res[0].createdAt.getTime() === res[0].updatedAt.getTime()) inserted++;
    else updated++;
  }

  console.log(`Done. ~${inserted} inserted, ~${updated} updated. Total catalog: ${LANGUAGE_CATALOG.length}`);
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
