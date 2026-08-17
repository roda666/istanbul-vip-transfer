/**
 * Static seed for the 6 new service page translations.
 *
 * Translations are pre-generated and committed as static data — no external
 * API calls are required at deployment time.  All inserts use ON CONFLICT DO NOTHING
 * so existing CMS edits are never overwritten.
 *
 * Run:  npx tsx db/seed-new-service-translations-static.ts
 * Also invoked by:  pnpm db:migrate
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 1 });

interface TranslationRow {
  slug: string;
  lang: string;
  title: string | null;
  body: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  imageAlt: string | null;
}

async function seed() {
  // Load static translation data committed alongside this file
  const dataPath = resolve(__dirname, 'new-service-translations-static.json');
  const translations: TranslationRow[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

  const slugs = [...new Set(translations.map(t => t.slug))];
  console.log(`Seeding translations for slugs: ${slugs.join(', ')}`);

  // Look up content IDs for the 6 new service pages
  const contentRows = await sql<{ id: string; slug: string }[]>`
    SELECT id::text AS id, slug
    FROM content
    WHERE slug = ANY(${slugs})
      AND content_type = 'SERVICE'
  `;

  if (contentRows.length === 0) {
    console.warn(
      '  ⚠ No matching content rows found — run seed-service-pages.ts or the Drizzle migration first.',
    );
    await sql.end();
    return;
  }

  const idBySlug = Object.fromEntries(contentRows.map(r => [r.slug, r.id]));
  console.log(`Found ${contentRows.length} content rows`);

  let inserted = 0;
  let skipped = 0;

  for (const t of translations) {
    const entityId = idBySlug[t.slug];
    if (!entityId) {
      console.warn(`  ⚠ Slug "${t.slug}" not found in DB — skipping`);
      continue;
    }

    const result = await sql`
      INSERT INTO content_translations (
        entity_type, entity_id, source_language_code, target_language_code,
        status, title, body, meta_title, meta_description, image_alt,
        is_ai_generated, ai_model, ai_prompt_version,
        draft_at, published_at, updated_at
      ) VALUES (
        'service_page', ${entityId}, 'tr', ${t.lang},
        'PUBLISHED',
        ${t.title ?? null}, ${t.body ?? null},
        ${t.metaTitle ?? null}, ${t.metaDescription ?? null}, ${t.imageAlt ?? null},
        true, 'gpt-5.4-mini', 'sp-1.1',
        now(), now(), now()
      )
      ON CONFLICT (entity_type, entity_id, target_language_code) DO NOTHING
    `;
    // postgres() returns affected row count via result.count
    const affected = (result as unknown as { count: number }).count ?? 0;
    if (affected > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`Done — inserted: ${inserted}, skipped (already exist): ${skipped}`);
  await sql.end();
}

seed().catch(err => {
  console.error('❌ seed-new-service-translations-static error:', err);
  process.exit(1);
});
