/**
 * check-page-meta.ts
 *
 * Build-time guard: exits with code 1 if any slug registered in
 * lib/page-registry.ts is missing translated metadata in lib/page-meta.json.
 *
 * Run via:  pnpm --filter @workspace/istanbul-vip-transfer check:page-meta
 * This is automatically called as the `prebuild` step.
 *
 * When you add a new page to PAGE_REGISTRY, this script will fail until you
 * also run `pnpm generate:page-meta` and commit the updated page-meta.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_REGISTRY } from '../lib/page-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE_META_PATH = path.join(ROOT, 'lib', 'page-meta.json');

/** Non-Turkish languages that must have translations for every slug. */
const REQUIRED_LANGS = ['en', 'de', 'ru', 'ar'];

interface SlugMeta { title: string; description: string }
type PageMeta = Record<string, Record<string, SlugMeta>>;

function main() {
  if (!fs.existsSync(PAGE_META_PATH)) {
    console.error(`✗  lib/page-meta.json not found at ${PAGE_META_PATH}`);
    process.exit(1);
  }

  const meta: PageMeta = JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8')) as PageMeta;
  const registeredSlugs = Object.keys(PAGE_REGISTRY);
  const errors: string[] = [];

  for (const slug of registeredSlugs) {
    if (!meta[slug]) {
      errors.push(`slug "${slug}" is missing entirely from page-meta.json`);
      continue;
    }
    for (const lang of REQUIRED_LANGS) {
      const entry = meta[slug][lang];
      if (!entry?.title) {
        errors.push(`slug "${slug}" is missing "${lang}.title"`);
      }
      if (!entry?.description) {
        errors.push(`slug "${slug}" is missing "${lang}.description"`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n✗  page-meta coverage check FAILED:\n');
    for (const err of errors) {
      console.error(`   • ${err}`);
    }
    console.error(`
Fix: run  pnpm --filter @workspace/istanbul-vip-transfer generate:page-meta
     to auto-generate missing translations via AI, then commit the updated
     lib/page-meta.json.
`);
    process.exit(1);
  }

  console.log(
    `✓  page-meta coverage OK — all ${registeredSlugs.length} slugs in PAGE_REGISTRY have en/de/ru/ar metadata`,
  );
}

main();
