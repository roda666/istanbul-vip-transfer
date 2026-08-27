#!/usr/bin/env node
/**
 * Build-time guard: a page can never be BOTH submitted in sitemap.xml AND
 * marked `robots: { index: false }` — that combination is a self-contradiction
 * (Google Search Console reports it as "Submitted URL marked noindex") and,
 * historically on this project, has meant SEO-complete pages were silently
 * excluded from search by a leftover draft flag (found 2026-08-27 audit).
 *
 * Scope: this script only checks statically-generated, per-slug top-level
 * page files — app/<slug>/page.tsx — for SERVICE content and the 4 core
 * static pages (hizmetler, araclar, hakkimizda, iletisim). Those are the only
 * files in this codebase that hardcode a *literal, unconditional* `robots`
 * object in `generateMetadata()`/`metadata`. Dynamic catch-all routes
 * (app/[lang]/[...slug], app/guzergah/[slug], app/[lang]/blog/[slug], etc.)
 * intentionally compute `index: false` CONDITIONALLY for missing/unpublished
 * content — that is correct behavior, not a conflict, and is deliberately
 * NOT scanned here (it never emits noindex for content that's actually live).
 *
 * A slug is "in the sitemap" using the exact same predicate as app/sitemap.ts:
 * content_type='SERVICE' AND status='PUBLISHED' AND is_active=true AND indexable=true,
 * or one of the 4 always-included static slugs.
 *
 * Run: node scripts/check-sitemap-noindex-conflict.mjs
 * Exit code 0 = clean. Exit code 1 = a conflict was found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from '../node_modules/postgres/src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');

// These 4 static info pages are always emitted in sitemap.ts's STATIC_SLUGS list.
const ALWAYS_IN_SITEMAP = ['hizmetler', 'araclar', 'hakkimizda', 'iletisim'];

/** True if the file hardcodes an unconditional `robots: { index: false` in its metadata. */
function hasHardcodedNoindex(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const src = fs.readFileSync(filePath, 'utf8');
  return /robots:\s*\{\s*index:\s*false/.test(src);
}

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  const conflicts = [];

  // ── Sitemap-eligible SERVICE slugs (same predicate as app/sitemap.ts) ──────
  const serviceRows = await sql`
    SELECT slug FROM content
    WHERE content_type = 'SERVICE'
      AND status = 'PUBLISHED'
      AND is_active = true
      AND indexable = true
  `;

  for (const { slug } of serviceRows) {
    const pageFile = path.join(APP_DIR, slug, 'page.tsx');
    if (hasHardcodedNoindex(pageFile)) {
      conflicts.push(
        `app/${slug}/page.tsx hardcodes robots: { index: false } but "${slug}" is PUBLISHED + active + indexable, so it is emitted in sitemap.xml.`,
      );
    }
  }

  // ── Always-included static pages ────────────────────────────────────────
  for (const slug of ALWAYS_IN_SITEMAP) {
    const pageFile = path.join(APP_DIR, slug, 'page.tsx');
    if (hasHardcodedNoindex(pageFile)) {
      conflicts.push(
        `app/${slug}/page.tsx hardcodes robots: { index: false } but "${slug}" is unconditionally included in sitemap.xml (app/sitemap.ts STATIC_SLUGS).`,
      );
    }
  }

  await sql.end();

  if (conflicts.length > 0) {
    console.error('\n✗  sitemap/noindex conflict check FAILED:\n');
    for (const c of conflicts) console.error(`   • ${c}`);
    console.error(
      `\nFix: either remove the page from sitemap eligibility (set is_active/indexable to false, ` +
        `or remove it from app/sitemap.ts STATIC_SLUGS) OR remove the hardcoded noindex override if ` +
        `the page is actually meant to be indexed.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓  sitemap/noindex check OK — ${serviceRows.length + ALWAYS_IN_SITEMAP.length} sitemap-eligible static pages carry no hardcoded noindex override`,
  );
}

main().catch((err) => {
  console.error('sitemap/noindex check crashed:', err);
  process.exit(1);
});
