/**
 * check-page-meta.ts
 *
 * Build-time guard: exits with code 1 if any slug registered in
 * lib/page-registry.ts is missing translated metadata in lib/page-meta.json,
 * OR if any slug's stored _sourceHash is missing or out of date (meaning the
 * Turkish source changed but generate:page-meta was not re-run),
 * OR if any WebPage slug is missing a component entry in lib/static-page-slugs.ts.
 *
 * Run via:  pnpm --filter @workspace/istanbul-vip-transfer check:page-meta
 * This is automatically called as the `prebuild` step.
 *
 * Use `pnpm new:page <slug>` to scaffold a new WebPage. It creates draft
 * metadata and all component wiring in one operation, so this check passes
 * immediately; run `pnpm generate:page-meta` to replace draft translations.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY } from '../lib/page-registry.js';
import { STATIC_PAGE_SLUGS } from '../lib/static-page-slugs.js';

/**
 * Returns a short SHA-256 digest (first 16 hex chars) of the combined
 * Turkish title and description — must stay in sync with generate-page-meta.ts.
 */
function hashTrSource(title: string, description: string): string {
  return crypto
    .createHash('sha256')
    .update(`${title}\n${description}`)
    .digest('hex')
    .slice(0, 16);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE_META_PATH = path.join(ROOT, 'lib', 'page-meta.json');

/** Non-Turkish languages that must have translations for every slug. */
const REQUIRED_LANGS = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];

interface SlugMeta { title: string; description: string }
type PageMeta = Record<string, Record<string, SlugMeta>>;

function main() {
  const errors: string[] = [];

  // ── Check 1: page-meta.json translation coverage ───────────────────────
  if (!fs.existsSync(PAGE_META_PATH)) {
    console.error(`✗  lib/page-meta.json not found at ${PAGE_META_PATH}`);
    process.exit(1);
  }

  const meta: PageMeta = JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8')) as PageMeta;
  const registeredSlugs = Object.keys(PAGE_REGISTRY);

  for (const slug of registeredSlugs) {
    if (!meta[slug]) {
      errors.push(`[page-meta] slug "${slug}" is missing entirely from page-meta.json`);
      continue;
    }

    // ── Hash staleness check ──────────────────────────────────────────────
    const { tr: trSource } = PAGE_REGISTRY[slug];
    const currentHash = hashTrSource(trSource.title, trSource.description);
    const storedEntry = meta[slug] as Record<string, unknown>;
    const storedHash = storedEntry._sourceHash as string | undefined;

    if (!storedHash) {
      errors.push(
        `[stale-hash] slug "${slug}" has no _sourceHash in page-meta.json — ` +
          `run generate:page-meta to record the current hash`,
      );
    } else if (storedHash !== currentHash) {
      errors.push(
        `[stale-hash] slug "${slug}" Turkish source changed ` +
          `(stored: ${storedHash}, current: ${currentHash}) — ` +
          `run generate:page-meta to refresh translations`,
      );
    }

    // ── Translation coverage check ────────────────────────────────────────
    for (const lang of REQUIRED_LANGS) {
      const entry = meta[slug][lang];
      if (!entry?.title) {
        errors.push(`[page-meta] slug "${slug}" is missing "${lang}.title"`);
      }
      if (!entry?.description) {
        errors.push(`[page-meta] slug "${slug}" is missing "${lang}.description"`);
      }
    }
  }

  // ── Check 2: every WebPage slug has a component entry ──────────────────
  const webPageSlugs = registeredSlugs.filter(
    (slug) => PAGE_REGISTRY[slug].schemaType === 'WebPage',
  );
  const staticSlugSet = new Set(STATIC_PAGE_SLUGS);
  const webPageSlugSet = new Set(webPageSlugs);

  for (const slug of webPageSlugs) {
    if (!staticSlugSet.has(slug)) {
      errors.push(
        `[components] WebPage slug "${slug}" is in PAGE_REGISTRY but missing from ` +
          `lib/static-page-slugs.ts — add it and wire up a component in ` +
          `app/[lang]/[...slug]/page.tsx STATIC_PAGE_MAP`,
      );
    }
  }

  for (const slug of STATIC_PAGE_SLUGS) {
    if (!webPageSlugSet.has(slug)) {
      errors.push(
        `[components] slug "${slug}" is in lib/static-page-slugs.ts but ` +
          `not registered as a WebPage in PAGE_REGISTRY — remove the stale entry`,
      );
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.error('\n✗  page checks FAILED:\n');
    for (const err of errors) {
      console.error(`   • ${err}`);
    }
    console.error(`
[stale-hash] Fix: run  pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta
             to re-translate stale slugs and update their _sourceHash in
             lib/page-meta.json, then commit the result.

[page-meta]  Fix: run  pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta
             to auto-generate missing translations via AI, then commit the updated
             lib/page-meta.json.

[components] Fix: run pnpm new:page <slug> for new static pages, or update
             lib/static-page-slugs.ts and STATIC_PAGE_MAP together.
`);
    process.exit(1);
  }

  console.log(
    `✓  page-meta coverage OK — all ${registeredSlugs.length} slugs in PAGE_REGISTRY have metadata for all 8 target locales`,
  );
  console.log(
    `✓  component coverage OK — all ${webPageSlugs.length} WebPage slugs have entries in lib/static-page-slugs.ts`,
  );
}

main();
