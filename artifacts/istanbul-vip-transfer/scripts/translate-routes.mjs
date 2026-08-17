/**
 * Generate translations for transfer_routes name/origin/destination fields.
 * Saves results as JSONB into the new *_translations columns.
 *
 * Usage:
 *   cd artifacts/istanbul-vip-transfer
 *   node scripts/translate-routes.mjs
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

const TARGET_LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

const LANG_NAMES = {
  en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic (Modern Standard Arabic)',
  fr: 'French', es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini';

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const ai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Translate a batch of short location strings for all 8 languages in one call
async function translateRouteBatch(rows) {
  const sys = `You are a professional translation engine for VIP transportation route names.
Translate Turkish location names and route titles to the requested languages.
Rules:
- Keep proper nouns (airport names, district names) as internationally recognized or as in the target language's standard.
- For Arabic: use Modern Standard Arabic, right-to-left.
- Return ONLY valid JSON with this exact shape:
  { "<slug>": { "name": {"en":"...","de":"...","ru":"...","ar":"...","fr":"...","es":"...","it":"...","nl":"..."}, "origin": {...8 langs...}, "destination": {...8 langs...} }, ... }
- Every slug must appear. Every language must appear for every field.`;

  const payload = Object.fromEntries(rows.map(r => [r.slug, { name: r.name, origin: r.origin, destination: r.destination }]));

  const user = `Translate these VIP transfer route strings to all 8 languages:\n\n${JSON.stringify(payload, null, 2)}\n\nReturn the JSON structure described above.`;

  const res = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  return JSON.parse(raw);
}

async function withRetry(fn, label, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`  [retry ${attempt}/${maxAttempts}] ${label}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

  console.log(`Model: ${MODEL}`);

  // Check column exists (migration ran)
  const colCheck = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='transfer_routes' AND column_name='name_translations'
  `;
  if (colCheck.length === 0) {
    console.error('Column name_translations not found — run migration first: pnpm db:migrate');
    await sql.end();
    process.exit(1);
  }

  const routes = await sql`
    SELECT id::text, slug, name, origin, destination, name_translations
    FROM transfer_routes
    WHERE active = true
    ORDER BY display_order
  `;
  console.log(`Found ${routes.length} active routes`);

  // Check which already have translations
  const needsTranslation = routes.filter(r => !r.name_translations);
  const alreadyDone = routes.length - needsTranslation.length;
  console.log(`Already translated: ${alreadyDone}, needs translation: ${needsTranslation.length}`);

  if (needsTranslation.length === 0) {
    console.log('All routes already have translations — done.');
    await sql.end();
    return;
  }

  // Translate all at once (they're short strings)
  console.log('\nTranslating all routes in one batch...');
  const translations = await withRetry(
    () => translateRouteBatch(needsTranslation),
    'routes-batch',
  );

  console.log(`\nSaving translations...`);
  for (const route of needsTranslation) {
    const t = translations[route.slug];
    if (!t) {
      console.warn(`  ⚠ No translation found for slug "${route.slug}"`);
      continue;
    }

    await sql`
      UPDATE transfer_routes SET
        name_translations        = ${JSON.stringify(t.name ?? {})},
        origin_translations      = ${JSON.stringify(t.origin ?? {})},
        destination_translations = ${JSON.stringify(t.destination ?? {})},
        updated_at               = now()
      WHERE id::text = ${route.id}
    `;
    console.log(`  ✓ ${route.slug}`);
  }

  // Verify
  const done = await sql`SELECT COUNT(*) AS n FROM transfer_routes WHERE name_translations IS NOT NULL`;
  console.log(`\nDone. ${done[0].n}/${routes.length} routes now have translations.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  try { await sql.end(); } catch {}
  process.exit(1);
});
