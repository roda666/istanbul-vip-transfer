/**
 * generate-page-meta.ts
 *
 * Generates translated metadata (title + description) for any page slugs
 * registered in lib/page-registry.ts that are missing from lib/page-meta.json,
 * and automatically re-translates slugs whose Turkish source has changed.
 *
 * Usage:
 *   pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta
 *   pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta -- --force
 *
 * Workflow:
 *  1. Reads PAGE_REGISTRY from lib/page-registry.ts (single source of truth)
 *  2. Reads the current page-meta.json
 *  3. For each slug:
 *     a. Computes a hash of the TR source (title + description)
 *     b. If the stored hash differs from the current hash (or --force is set),
 *        marks all target languages as stale → re-translates them
 *     c. Otherwise, only translates languages that are missing
 *  4. Writes the updated page-meta.json (including the new _sourceHash)
 *
 * Requires: OPENAI_API_KEY in environment (or .env.local)
 */
import 'dotenv/config';
import crypto from 'node:crypto';
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
/** Each slug entry: language code → translation, plus an optional _sourceHash. */
type SlugEntry = Record<string, SlugMeta> & { _sourceHash?: string };
type PageMeta = Record<string, SlugEntry>;

// ── Hashing ──────────────────────────────────────────────────────────────────
/**
 * Returns a short SHA-256 digest (first 16 hex chars) of the combined
 * Turkish title and description.  Stable across runs for the same input.
 */
function hashTrSource(title: string, description: string): string {
  return crypto
    .createHash('sha256')
    .update(`${title}\n${description}`)
    .digest('hex')
    .slice(0, 16);
}

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
  const force = process.argv.includes('--force');
  if (force) {
    console.log('⚡ --force mode: all translations will be regenerated.\n');
  }

  // Load existing metadata
  const meta: PageMeta = fs.existsSync(PAGE_META_PATH)
    ? (JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8')) as PageMeta)
    : {};

  let generated = 0;
  let skipped = 0;
  let staleDetected = 0;

  for (const [slug, entry] of Object.entries(PAGE_REGISTRY)) {
    const { tr: trSource } = entry;

    // Ensure the slug entry exists
    if (!meta[slug]) {
      meta[slug] = {};
    }

    // Always write/update Turkish source
    meta[slug]['tr'] = trSource;

    // Compute current hash and compare with stored hash
    const currentHash = hashTrSource(trSource.title, trSource.description);
    const storedHash = meta[slug]._sourceHash;
    const sourceChanged = storedHash !== undefined && storedHash !== currentHash;

    if (sourceChanged) {
      console.log(
        `⚠  ${slug} — Turkish source changed (hash ${storedHash} → ${currentHash}), re-translating all languages`,
      );
      staleDetected++;
    }

    // Determine which languages need (re-)translation
    const langsToTranslate = Object.entries(TARGET_LANGS).filter(([code]) => {
      if (force) return true;
      if (sourceChanged) return true;
      return !meta[slug][code]?.title || !meta[slug][code]?.description;
    });

    if (langsToTranslate.length === 0) {
      console.log(`✓  ${slug} — all languages present and up-to-date`);
      skipped++;
      // Still update stored hash in case it was missing
      meta[slug]._sourceHash = currentHash;
      continue;
    }

    if (!sourceChanged && !force) {
      console.log(
        `→  ${slug} — generating ${langsToTranslate.map(([c]) => c).join(', ')} ...`,
      );
    }

    let allSucceeded = true;
    for (const [code, name] of langsToTranslate) {
      try {
        const translated = await translateMeta(trSource.title, trSource.description, code, name);
        meta[slug][code] = translated;
        console.log(`   ✓ ${code}: ${translated.title}`);
        generated++;
      } catch (err) {
        console.error(`   ✗ ${code}: ${err instanceof Error ? err.message : String(err)}`);
        allSucceeded = false;
      }
    }

    // Only advance the stored hash when every language translated successfully.
    // If any language failed, leave the hash stale so the next run retries them.
    if (allSucceeded) {
      meta[slug]._sourceHash = currentHash;
    } else {
      console.warn(
        `   ⚠ ${slug} — some languages failed; hash not updated so they will be retried next run`,
      );
    }
  }

  // Write updated metadata back
  fs.writeFileSync(PAGE_META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const summary = [
    `Generated ${generated} translations`,
    staleDetected > 0 ? `re-translated ${staleDetected} stale slug(s)` : null,
    `skipped ${skipped} up-to-date slugs`,
  ]
    .filter(Boolean)
    .join(', ');
  console.log(`\nDone. ${summary}.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
