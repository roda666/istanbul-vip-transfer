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
 *   pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta -- --prune
 *   pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta -- --prune --force
 *
 * Flags:
 *   --force   Re-translate all languages even if they appear up-to-date.
 *   --prune   Remove orphaned entries (slugs in page-meta.json that are no
 *             longer in PAGE_REGISTRY). Without this flag the script only
 *             warns about orphans; it never deletes anything.
 *
 * Workflow:
 *  1. Reads PAGE_REGISTRY from lib/page-registry.ts (single source of truth)
 *  2. Reads the current page-meta.json
 *  3. Detects orphaned slugs (present in page-meta.json but absent from
 *     PAGE_REGISTRY) and logs a warning for each one.
 *     - If a registry slug has the same _sourceHash as an orphan, it is
 *       treated as a rename: existing translations are carried forward so
 *       no API calls are wasted on content that is already translated.
 *     - With --prune, orphaned entries are removed from the output file.
 *  4. For each registry slug:
 *     a. Computes a hash of the TR source (title + description)
 *     b. If the stored hash differs from the current hash (or --force is set),
 *        marks all target languages as stale → re-translates them
 *     c. Otherwise, only translates languages that are missing
 *  5. Writes the updated page-meta.json (including the new _sourceHash)
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
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  nl: 'Dutch',
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
    model: process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini',
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

// ── Orphan detection & rename carry-forward ──────────────────────────────────
/**
 * Scans page-meta.json for slugs that are no longer in PAGE_REGISTRY.
 *
 * - Logs a warning for every orphan found.
 * - If a registry slug shares the same _sourceHash as an orphan, it is
 *   treated as a rename: existing translations are copied into the new slug
 *   entry so the main translation loop can skip them.
 * - Returns the set of orphan slugs so the caller can prune them if desired.
 */
function detectOrphans(
  meta: PageMeta,
  registryHashes: Map<string, string>, // hash → registry slug
): Set<string> {
  const registrySlugs = new Set(Object.keys(PAGE_REGISTRY));
  const orphans = new Set<string>();

  for (const metaSlug of Object.keys(meta)) {
    if (registrySlugs.has(metaSlug)) continue;

    orphans.add(metaSlug);

    const orphanHash = meta[metaSlug]._sourceHash;
    const renamedTo = orphanHash ? registryHashes.get(orphanHash) : undefined;

    if (renamedTo) {
      console.log(
        `🔄  "${metaSlug}" → "${renamedTo}": source hash matches — treating as a rename. ` +
          `Carrying forward existing translations.`,
      );
      // Copy translations into the target slug (create the entry if needed).
      if (!meta[renamedTo]) meta[renamedTo] = {};
      for (const [key, value] of Object.entries(meta[metaSlug])) {
        // Only copy language translations that the target doesn't already have.
        if (key !== '_sourceHash' && !meta[renamedTo][key]) {
          (meta[renamedTo] as Record<string, unknown>)[key] = value;
        }
      }
    } else {
      console.warn(
        `⚠  Orphan: "${metaSlug}" is in page-meta.json but not in PAGE_REGISTRY. ` +
          `Run with --prune to remove it.`,
      );
    }
  }

  return orphans;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const force = process.argv.includes('--force');
  const prune = process.argv.includes('--prune');

  if (force) {
    console.log('⚡ --force mode: all translations will be regenerated.\n');
  }
  if (prune) {
    console.log('🗑  --prune mode: orphaned entries will be removed.\n');
  }

  // Load existing metadata
  const meta: PageMeta = fs.existsSync(PAGE_META_PATH)
    ? (JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8')) as PageMeta)
    : {};

  // Build a hash → registry-slug map for rename detection.
  const registryHashes = new Map<string, string>();
  for (const [slug, entry] of Object.entries(PAGE_REGISTRY)) {
    const hash = hashTrSource(entry.tr.title, entry.tr.description);
    registryHashes.set(hash, slug);
  }

  // ── Step 1: detect orphans and carry forward renamed translations ──────────
  const orphans = detectOrphans(meta, registryHashes);
  if (orphans.size > 0) {
    console.log(''); // blank line after orphan block
  }

  // ── Step 2: process every registry slug ──────────────────────────────────
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

  // ── Step 3: prune orphans if requested ───────────────────────────────────
  if (prune && orphans.size > 0) {
    console.log('');
    for (const orphanSlug of orphans) {
      delete meta[orphanSlug];
      console.log(`🗑  Pruned orphan: "${orphanSlug}"`);
    }
  }

  // ── Step 4: write updated metadata ───────────────────────────────────────
  fs.writeFileSync(PAGE_META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const summaryParts: string[] = [`Generated ${generated} translations`];
  if (staleDetected > 0) summaryParts.push(`re-translated ${staleDetected} stale slug(s)`);
  summaryParts.push(`skipped ${skipped} up-to-date slugs`);
  if (orphans.size > 0) {
    summaryParts.push(
      prune
        ? `pruned ${orphans.size} orphan(s)`
        : `found ${orphans.size} orphan(s) — run with --prune to remove`,
    );
  }
  console.log(`\nDone. ${summaryParts.join(', ')}.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
