#!/usr/bin/env node
/**
 * Build-time guard: every AI-generated image (ai-images/...) must use the
 * SEO-descriptive filename convention (see lib/studio/image-filename.ts) and
 * carry non-empty alt text. This catches:
 *
 *   (a) a bare random-UUID filename slipping back in — the old convention
 *       that wastes a real Google Images ranking signal, and
 *   (b) an AI-managed image saved with blank/missing alt text.
 *
 * Scans the same tables as scripts/rename-ai-images-seo.mjs: content (hero/og
 * + SERVICE JSON body / BLOG_POST markdown body), vehicles (cover/gallery),
 * studio_projects, studio_images.
 *
 * Run: node scripts/check-image-filenames.mjs
 * Exit code 0 = clean. Exit code 1 = a violation was found.
 */
import postgres from '../node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL);
const OBJ_PREFIX = '/api/storage/objects/';

function isBareUuidFile(url) {
  if (!url || !url.startsWith(`${OBJ_PREFIX}ai-images/`)) return false;
  const file = url.split('/').pop() ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(file);
}

const findings = [];
function check(source, ref, url, alt) {
  if (!url || !url.startsWith(`${OBJ_PREFIX}ai-images/`)) return;
  if (isBareUuidFile(url)) findings.push({ source, ref, kind: 'bare-uuid-filename', url });
  if (!alt || !alt.trim()) findings.push({ source, ref, kind: 'empty-alt-text', url });
}

// ── content: hero/og + body-embedded images ────────────────────────────────
const contentRows = await sql`
  SELECT id, slug, content_type, hero_image, hero_image_alt, og_image, body, draft_body
  FROM content`;
for (const row of contentRows) {
  check('content.hero_image', row.slug, row.hero_image, row.hero_image_alt);
  // og_image reuses hero_image_alt (no dedicated column) — only flag bare-uuid, not alt.
  if (row.og_image && row.og_image !== row.hero_image && isBareUuidFile(row.og_image)) {
    findings.push({ source: 'content.og_image', ref: row.slug, kind: 'bare-uuid-filename', url: row.og_image });
  }
  for (const [field, raw] of [['body', row.body], ['draft_body', row.draft_body]]) {
    if (!raw) continue;
    if (row.content_type === 'SERVICE') {
      let parsed;
      try { parsed = JSON.parse(raw); } catch { continue; }
      for (const section of parsed.contentSections ?? []) {
        if (section.image?.src) check(`content.${field}.contentSections[].image`, row.slug, section.image.src, section.image.alt);
      }
      for (const img of parsed.inlineImages ?? []) {
        check(`content.${field}.inlineImages[]`, row.slug, img.src, img.alt);
      }
    } else {
      const re = /!\[([^\]]*)\]\((\/api\/storage\/objects\/[^\s)]+)\)/g;
      for (const m of raw.matchAll(re)) check(`content.${field} (markdown)`, row.slug, m[2], m[1]);
    }
  }
}

// ── vehicles: cover/og/gallery ──────────────────────────────────────────────
const vehicleRows = await sql`SELECT id, slug, cover_image, cover_image_alt, og_image, gallery FROM vehicles`;
for (const row of vehicleRows) {
  check('vehicles.cover_image', row.slug, row.cover_image, row.cover_image_alt);
  if (row.og_image && row.og_image !== row.cover_image && isBareUuidFile(row.og_image)) {
    findings.push({ source: 'vehicles.og_image', ref: row.slug, kind: 'bare-uuid-filename', url: row.og_image });
  }
  for (const item of row.gallery ?? []) check('vehicles.gallery[]', row.slug, item?.url, item?.alt);
}

// ── studio_projects ─────────────────────────────────────────────────────────
const studioProjectRows = await sql`SELECT id, title_working, cover_image_url, cover_image_alt FROM studio_projects`;
for (const row of studioProjectRows) {
  check('studio_projects.cover_image_url', row.title_working ?? row.id, row.cover_image_url, row.cover_image_alt);
}

// ── studio_images ────────────────────────────────────────────────────────────
const studioImageRows = await sql`SELECT id, object_path, url, alt_text FROM studio_images`;
for (const row of studioImageRows) {
  const url = row.url ?? (row.object_path ? `${OBJ_PREFIX}${row.object_path}` : null);
  check('studio_images.url', row.id, url, row.alt_text);
}

await sql.end();

console.log(`\n── AI image filename/alt-text check — scanned ${contentRows.length + vehicleRows.length + studioProjectRows.length + studioImageRows.length} rows ──\n`);

if (findings.length === 0) {
  console.log('✓ Every AI-managed image uses the SEO filename convention and has alt text.\n');
  process.exit(0);
}

for (const f of findings) {
  console.error(`✗ [${f.source}] ref=${f.ref} (${f.kind})`);
  console.error(`  ${f.url}`);
}
console.error(`\n✗ FAILED: ${findings.length} image reference(s) violate the SEO filename/alt-text policy.`);
console.error('  Bare-uuid filenames must be renamed via lib/studio/image-filename.ts::buildSeoImageFilename.');
console.error('  Empty alt text must be filled in before the image can be considered AI-managed content.\n');
process.exit(1);
