/**
 * generate-page-meta.ts
 *
 * Generates translated metadata (title + description) for any page slugs
 * registered in lib/page-registry.ts that are missing from lib/page-meta.json.
 *
 * Usage:
 *   pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta
 *
 * Workflow:
 *  1. Reads PAGE_REGISTRY from lib/page-registry.ts (single source of truth)
 *  2. Reads the current page-meta.json
 *  3. For each slug missing any translations, calls OpenAI to generate en/de/ru/ar
 *  4. Writes the updated page-meta.json
 *
 * Requires: OPENAI_API_KEY in environment (or .env.local)
 *
 * When a new page is added to PAGE_REGISTRY with its Turkish source metadata,
 * this script will automatically generate translations for it.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY } from '../lib/page-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE_META_PATH = path.join(ROOT, 'lib', 'page-meta.json');

/** Languages to generate (Turkish is the source — never generated). */
const TARGET_LANGS: Record<string, string> = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  ar: 'Arabic',
};

// ── Types ───────────────────────────────────────────────────────────────────
interface SlugMeta {
  title: string;
  description: string;
}
type PageMeta = Record<string, Record<string, SlugMeta>>;

// ── OpenAI translation ───────────────────────────────────────────────────────
async function translateMeta(
  trTitle: string,
  trDescription: string,
  langCode: string,
  langName: string,
): Promise<SlugMeta> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert SEO translator specializing in luxury transportation and tourism.
Translate Turkish metadata into ${langName} for a premium Istanbul VIP transfer website.

RULES — NEVER VIOLATE:
1. Keep verbatim: "VIP Transfer Istanbul", "Istanbul VIP Transfer", "IST", "SAW", "Mercedes Vito", "Mercedes Sprinter"
2. Keep phone numbers, URLs, and email addresses exactly as-is
3. For Arabic: use Modern Standard Arabic appropriate for a luxury service
4. title: 50-70 characters, compelling and keyword-rich
5. description: 140-165 characters, concise and action-oriented
6. Output ONLY a JSON object with exactly two keys: "title" and "description"`;

  const userPrompt = `Translate to ${langName}:
Title (TR): ${trTitle}
Description (TR): ${trDescription}`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw) as { title?: string; description?: string };
  if (!parsed.title || !parsed.description) {
    throw new Error(`Invalid response shape: ${raw}`);
  }

  return { title: parsed.title, description: parsed.description };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Load existing metadata
  const meta: PageMeta = fs.existsSync(PAGE_META_PATH)
    ? (JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8')) as PageMeta)
    : {};

  let generated = 0;
  let skipped = 0;

  for (const [slug, entry] of Object.entries(PAGE_REGISTRY)) {
    const { tr: trSource } = entry;

    // Ensure the slug entry exists
    if (!meta[slug]) {
      meta[slug] = {};
    }

    // Always write/update Turkish source
    meta[slug]['tr'] = trSource;

    // Check which target languages are missing
    const missingLangs = Object.entries(TARGET_LANGS).filter(
      ([code]) => !meta[slug][code]?.title || !meta[slug][code]?.description,
    );

    if (missingLangs.length === 0) {
      console.log(`✓  ${slug} — all languages present`);
      skipped++;
      continue;
    }

    console.log(`→  ${slug} — generating ${missingLangs.map(([c]) => c).join(', ')} ...`);

    for (const [code, name] of missingLangs) {
      try {
        const translated = await translateMeta(trSource.title, trSource.description, code, name);
        meta[slug][code] = translated;
        console.log(`   ✓ ${code}: ${translated.title}`);
        generated++;
      } catch (err) {
        console.error(`   ✗ ${code}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Write updated metadata back
  fs.writeFileSync(PAGE_META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  console.log(`\nDone. Generated ${generated} translations, skipped ${skipped} complete slugs.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
