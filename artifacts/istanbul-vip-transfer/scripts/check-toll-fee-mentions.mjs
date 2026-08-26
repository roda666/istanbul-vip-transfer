#!/usr/bin/env node
/**
 * Build-time guard: fails when customer-visible copy (blog posts, service
 * pages, homepage, vehicle copy, and transfer route pages) mentions the PRICE
 * of a bridge/tunnel/highway/ferry crossing. Pricing for these crossings is
 * handled exclusively by the protected toll pricing engine (toll_points /
 * toll_tariffs) — public prose must never quote or imply a crossing fee.
 *
 * Purely geographic mentions ("the route crosses a bridge/highway") are
 * intentionally allowed and must NOT be flagged — only sentences where a
 * geography term (bridge/tunnel/highway/ferry) co-occurs with a money term
 * (fee/toll/cost/charge), or a dedicated "toll" word appears on its own
 * (toll/péage/peaje/pedaggio/Maut/tol/geçiş ücreti/رسوم العبور — these already
 * mean "crossing fee" without needing a separate geography word).
 *
 * Scans two customer-visible sources, scoped to PUBLISHED rows only:
 *   1. content (TR source) + content_translations (8 target languages) —
 *      covers blog posts, service pages, homepage, and vehicle copy.
 *   2. transfer_routes (TR source) + transfer_route_translations —
 *      covers route pages, including JSONB transport_options/route_notes/faq_items.
 *
 * The actual rule set + matching logic lives in scripts/lib/toll-fee-rules.mjs
 * (side-effect-free, unit-tested by scripts/test-check-toll-fee-mentions.mjs).
 *
 * Run: node scripts/check-toll-fee-mentions.mjs
 * Exit code 0 = clean. Exit code 1 = a genuine fee mention was found.
 */
import postgres from '../node_modules/postgres/src/index.js';
import { LANGS, findViolations, findViolationsInField, collectStrings } from './lib/toll-fee-rules.mjs';

const sql = postgres(process.env.DATABASE_URL);

const findings = [];
let scannedRows = 0;

// ── 1. content (TR) ──────────────────────────────────────────────────────
{
  const rows = await sql`
    SELECT id, slug, content_type, title, excerpt, body, seo_title, seo_description
    FROM content WHERE status = 'PUBLISHED'`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['title', row.title], ['excerpt', row.excerpt], ['body', row.body],
      ['seo_title', row.seo_title], ['seo_description', row.seo_description],
    ]) {
      for (const v of findViolationsInField(val, 'tr', field)) {
        findings.push({ source: 'content', slug: row.slug, contentType: row.content_type, lang: 'tr', ...v });
      }
    }
  }
}

// ── 2. content_translations (non-TR) ────────────────────────────────────
{
  const rows = await sql`
    SELECT ct.id, ct.entity_type, ct.target_language_code AS lang, ct.title, ct.excerpt, ct.body,
           ct.meta_title, ct.meta_description, c.slug AS source_slug, c.content_type
    FROM content_translations ct
    LEFT JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.status = 'PUBLISHED' AND ct.target_language_code = ANY(${LANGS})`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['title', row.title], ['excerpt', row.excerpt], ['body', row.body],
      ['meta_title', row.meta_title], ['meta_description', row.meta_description],
    ]) {
      for (const v of findViolationsInField(val, row.lang, field)) {
        findings.push({
          source: 'content_translations', slug: row.source_slug ?? `entity:${row.entity_type}`,
          contentType: row.content_type ?? row.entity_type, lang: row.lang, ...v,
        });
      }
    }
  }
}

// ── 3. transfer_routes (TR) ──────────────────────────────────────────────
{
  const rows = await sql`
    SELECT id, slug, description, seo_title, seo_description, intro_paragraph,
           transport_options, route_notes, faq_items
    FROM transfer_routes WHERE active = true`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['description', row.description], ['seo_title', row.seo_title],
      ['seo_description', row.seo_description], ['intro_paragraph', row.intro_paragraph],
    ]) {
      for (const v of findViolations(val, 'tr', field)) {
        findings.push({ source: 'transfer_routes', slug: row.slug, contentType: 'ROUTE', lang: 'tr', ...v });
      }
    }
    for (const jsonField of ['transport_options', 'route_notes', 'faq_items']) {
      for (const [path, str] of collectStrings(row[jsonField])) {
        for (const v of findViolations(str, 'tr', `${jsonField}.${path}`)) {
          findings.push({ source: 'transfer_routes', slug: row.slug, contentType: 'ROUTE', lang: 'tr', ...v });
        }
      }
    }
  }
}

// ── 4. transfer_route_translations (non-TR) ─────────────────────────────
{
  const rows = await sql`
    SELECT trt.id, trt.language_code AS lang, trt.description, trt.seo_title, trt.seo_description,
           trt.intro_paragraph, trt.transport_options, trt.route_notes, trt.faq_items, tr.slug
    FROM transfer_route_translations trt
    JOIN transfer_routes tr ON tr.id = trt.route_id
    WHERE trt.status = 'PUBLISHED' AND trt.language_code = ANY(${LANGS})`;
  for (const row of rows) {
    scannedRows++;
    for (const [field, val] of [
      ['description', row.description], ['seo_title', row.seo_title],
      ['seo_description', row.seo_description], ['intro_paragraph', row.intro_paragraph],
    ]) {
      for (const v of findViolations(val, row.lang, field)) {
        findings.push({ source: 'transfer_route_translations', slug: row.slug, contentType: 'ROUTE', lang: row.lang, ...v });
      }
    }
    for (const jsonField of ['transport_options', 'route_notes', 'faq_items']) {
      for (const [path, str] of collectStrings(row[jsonField])) {
        for (const v of findViolations(str, row.lang, `${jsonField}.${path}`)) {
          findings.push({ source: 'transfer_route_translations', slug: row.slug, contentType: 'ROUTE', lang: row.lang, ...v });
        }
      }
    }
  }
}

await sql.end();

console.log(`\n── Toll/fee customer-copy check — scanned ${scannedRows} published rows across content + transfer_routes ──\n`);

if (findings.length === 0) {
  console.log('✓ No bridge/tunnel/highway/ferry FEE mentions found in customer-visible copy.\n');
  process.exit(0);
}

for (const f of findings) {
  console.error(`✗ [${f.source}] slug=${f.slug} type=${f.contentType} lang=${f.lang} field=${f.field} (${f.kind})`);
  console.error(`  "${f.sentence}"`);
}
console.error(`\n✗ FAILED: ${findings.length} customer-visible sentence(s) mention a bridge/tunnel/highway/ferry crossing FEE.`);
console.error('  Toll/crossing pricing must only ever come from the protected toll pricing engine.');
console.error('  Rewrite the sentence(s) above to drop the fee mention (geography-only phrasing is fine).\n');
process.exit(1);
