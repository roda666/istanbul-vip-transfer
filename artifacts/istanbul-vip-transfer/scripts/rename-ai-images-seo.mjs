#!/usr/bin/env node
/**
 * One-time SEO filename migration for every existing AI-generated image
 * (blog covers, blog inline images, service hero + section images).
 *
 * The old convention stored every image under a bare random UUID filename
 * (e.g. 96e82e84-3edc-4721-a0d6-3560ec8de34c.webp), wasting a real Google
 * Images ranking signal. This script:
 *
 *   1. Scans every table that can reference an AI image (content, its
 *      translations, vehicles, studio_projects, studio_images,
 *      transfer_routes) and collects the best available alt text / fallback
 *      topic string for each unique old URL.
 *   2. Computes a new descriptive filename via the same rule as
 *      lib/studio/image-filename.ts::buildSeoImageFilename — words from the
 *      alt text + the first 8 hex chars of the OLD uuid as a stable, unique
 *      suffix (so the new name stays traceable to the old one). Directory
 *      structure (which already encodes the page slug) is preserved —
 *      only the filename leaf changes.
 *   3. Copies each object's bytes to the new key, verifies the copy, THEN
 *      rewrites every DB reference to the new URL, THEN deletes the old key.
 *      This ordering means nothing is ever briefly broken or double-deleted.
 *
 * Usage: node scripts/rename-ai-images-seo.mjs [--dry-run]
 * --dry-run computes and prints the full plan (including the storage copy
 * check) but performs no DB writes and no deletions.
 */
import postgres from '../node_modules/postgres/src/index.js';

const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const DRY_RUN = process.argv.includes('--dry-run');
const OBJ_PREFIX = '/api/storage/objects/';

// ── Keep in sync with lib/studio/image-filename.ts ──────────────────────────
const TURKISH_CHAR_MAP = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
const STOPWORDS = new Set(['ve', 'ile', 'için', 'bir', 'bu', 'şu', 'da', 'de', 'ki', 'mi', 'mı', 'mu', 'mü', 'gibi', 'çok', 'daha', 'en', 'olan', 'olarak']);
function slugWords(input) {
  let s = input;
  for (const [from, to] of Object.entries(TURKISH_CHAR_MAP)) s = s.split(from).join(to);
  s = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9\s-]/g, ' ');
  return s.split(/[\s-]+/).map((w) => w.trim()).filter(Boolean);
}
function buildSeoImageFilename(altText, { fallback, sourceId } = {}) {
  const suffix = (sourceId ?? '').replace(/-/g, '').slice(0, 8);
  const primary = slugWords(altText ?? '').filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  const words = primary.length > 0 ? primary : slugWords(fallback ?? '').filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  const chosen = words.slice(0, 6);
  const base = chosen.length > 0 ? chosen.join('-') : 'gorsel';
  return `${base}-${suffix}.webp`;
}
function isBareUuid(name) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
}

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '';
    return { bucket, prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function signUrl(bucket, objectName, method) {
  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket_name: bucket, object_name: objectName, method, expires_at: new Date(Date.now() + 900_000).toISOString() }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`signing failed (${res.status})`);
  const data = await res.json();
  if (typeof data.signed_url !== 'string') throw new Error('invalid signing response');
  return data.signed_url;
}

/** Replace image src fields inside a SERVICE JSON body or a BLOG_POST markdown body. */
function rewriteBody(raw, contentType, moved) {
  if (!raw) return raw;
  if (contentType === 'SERVICE') {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return raw; }
    let changed = false;
    for (const section of parsed.contentSections ?? []) {
      if (section.image?.src && moved.has(section.image.src)) { section.image.src = moved.get(section.image.src).newUrl; changed = true; }
    }
    for (const img of parsed.inlineImages ?? []) {
      if (img.src && moved.has(img.src)) { img.src = moved.get(img.src).newUrl; changed = true; }
    }
    return changed ? JSON.stringify(parsed) : raw;
  }
  // BLOG_POST / plain text — markdown ![alt](url) plus any other bare occurrence.
  let out = raw;
  for (const [oldUrl, plan] of moved) {
    if (out.includes(oldUrl)) out = out.split(oldUrl).join(plan.newUrl);
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) throw new Error('PRIVATE_OBJECT_DIR not set');
  const { bucket, prefix } = parsePrivateDir(privateDir);
  if (!bucket) throw new Error('PRIVATE_OBJECT_DIR is invalid');

  const sql = postgres(process.env.DATABASE_URL);
  try {
    // ── PASS 1: collect best alt/fallback per unique old URL ───────────────
    const altCandidates = new Map(); // oldUrl -> { alt, fallback }
    function note(url, alt, fallback) {
      if (!url || !url.startsWith(OBJ_PREFIX)) return;
      const cur = altCandidates.get(url) ?? { alt: '', fallback: '' };
      if (!cur.alt && alt) cur.alt = alt.trim();
      if (!cur.fallback && fallback) cur.fallback = fallback.trim();
      altCandidates.set(url, cur);
    }

    const contentRows = await sql`
      SELECT id, slug, title, content_type, hero_image, hero_image_alt, og_image, body, draft_body
      FROM content`;
    for (const row of contentRows) {
      note(row.hero_image, row.hero_image_alt, row.title);
      note(row.og_image, row.hero_image_alt, row.title);
      for (const raw of [row.body, row.draft_body]) {
        if (!raw) continue;
        if (row.content_type === 'SERVICE') {
          let parsed; try { parsed = JSON.parse(raw); } catch { continue; }
          for (const section of parsed.contentSections ?? []) {
            if (section.image?.src) note(section.image.src, section.image.alt, section.heading || row.title);
          }
          for (const img of parsed.inlineImages ?? []) note(img.src, img.alt, row.title);
        } else {
          const re = /!\[([^\]]*)\]\((\/api\/storage\/objects\/[^\s)]+)\)/g;
          for (const m of raw.matchAll(re)) note(m[2], m[1], row.title);
        }
      }
    }

    const vehicleRows = await sql`SELECT id, slug, name, cover_image, cover_image_alt, og_image, gallery FROM vehicles`;
    for (const row of vehicleRows) {
      note(row.cover_image, row.cover_image_alt, row.name);
      note(row.og_image, row.cover_image_alt, row.name);
      for (const item of row.gallery ?? []) note(item?.url, item?.alt, row.name);
    }

    const studioProjectRows = await sql`SELECT id, cover_image_url, cover_image_alt, title_working FROM studio_projects`;
    for (const row of studioProjectRows) note(row.cover_image_url, row.cover_image_alt, row.title_working);

    const studioImageRows = await sql`SELECT id, object_path, url, alt_text FROM studio_images`;
    for (const row of studioImageRows) {
      const url = row.url ?? (row.object_path ? `${OBJ_PREFIX}${row.object_path}` : null);
      note(url, row.alt_text, null);
    }

    const routeRows = await sql`SELECT id, slug, name, image_path FROM transfer_routes`;
    for (const row of routeRows) note(row.image_path, null, row.name);

    // ── PASS 2: build the rename plan ───────────────────────────────────────
    const usedKeys = new Set();
    const renamePlan = new Map(); // oldUrl -> { newUrl, oldObjectName, newObjectName, alt }
    for (const [oldUrl, { alt, fallback }] of altCandidates) {
      const objectName = oldUrl.slice(OBJ_PREFIX.length);
      const segments = objectName.split('/');
      const oldFile = segments.pop();
      const oldId = oldFile.replace(/\.webp$/i, '');
      if (!isBareUuid(oldId)) continue; // already SEO-named or non-AI asset — leave alone
      const dir = segments.join('/');
      let filename = buildSeoImageFilename(alt, { fallback, sourceId: oldId });
      let key = dir ? `${dir}/${filename}` : filename;
      let n = 1;
      while (usedKeys.has(key)) { filename = filename.replace(/\.webp$/, `-${n++}.webp`); key = dir ? `${dir}/${filename}` : filename; }
      usedKeys.add(key);
      renamePlan.set(oldUrl, { newUrl: `${OBJ_PREFIX}${key}`, oldObjectName: objectName, newObjectName: key, alt });
    }

    console.log(`Found ${renamePlan.size} image(s) still using the old random-UUID filename.${DRY_RUN ? ' (dry run)' : ''}\n`);
    if (renamePlan.size === 0) return;

    // ── PASS 3: copy bytes old key -> new key, verify ───────────────────────
    const moved = new Map(); // oldUrl -> plan (only confirmed copies)
    for (const [oldUrl, plan] of renamePlan) {
      try {
        const getUrl = await signUrl(bucket, [prefix, plan.oldObjectName].filter(Boolean).join('/'), 'GET');
        const res = await fetch(getUrl, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) { console.log(`  ✗ ${oldUrl}: source fetch failed (${res.status})`); continue; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!DRY_RUN) {
          const putUrl = await signUrl(bucket, [prefix, plan.newObjectName].filter(Boolean).join('/'), 'PUT');
          const buf = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(buf).set(bytes);
          const put = await fetch(putUrl, {
            method: 'PUT', headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
            body: buf, signal: AbortSignal.timeout(60_000),
          });
          if (!put.ok) { console.log(`  ✗ ${oldUrl}: copy to new key failed (${put.status})`); continue; }
          // Verify the new key is actually readable before touching any DB row.
          const verifyGet = await signUrl(bucket, [prefix, plan.newObjectName].filter(Boolean).join('/'), 'GET');
          const verify = await fetch(verifyGet, { signal: AbortSignal.timeout(30_000) });
          if (!verify.ok) { console.log(`  ✗ ${oldUrl}: new key not readable after copy (${verify.status})`); continue; }
        }
        moved.set(oldUrl, plan);
        console.log(`  ${DRY_RUN ? '(dry) ' : ''}✓ ${plan.oldObjectName}\n      → ${plan.newObjectName} (${bytes.byteLength} bytes)`);
      } catch (err) {
        console.log(`  ✗ ${oldUrl}: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (DRY_RUN) {
      console.log(`\nDry run: ${moved.size}/${renamePlan.size} would be renamed. No DB writes, no deletions performed.`);
      return;
    }

    // ── PASS 4: rewrite DB references ───────────────────────────────────────
    let contentRowsUpdated = 0;
    for (const row of contentRows) {
      let heroImage = row.hero_image, ogImage = row.og_image, body = row.body, draftBody = row.draft_body;
      let changed = false;
      if (heroImage && moved.has(heroImage)) { heroImage = moved.get(heroImage).newUrl; changed = true; }
      if (ogImage && moved.has(ogImage)) { ogImage = moved.get(ogImage).newUrl; changed = true; }
      const newBody = rewriteBody(body, row.content_type, moved);
      if (newBody !== body) { body = newBody; changed = true; }
      const newDraft = rewriteBody(draftBody, row.content_type, moved);
      if (newDraft !== draftBody) { draftBody = newDraft; changed = true; }
      if (changed) {
        await sql`UPDATE content SET hero_image=${heroImage}, og_image=${ogImage}, body=${body}, draft_body=${draftBody}, updated_at=now() WHERE id=${row.id}`;
        contentRowsUpdated++;
      }
    }

    let translationRowsUpdated = 0;
    const translationRows = await sql`
      SELECT ctx.id, ctx.body, c.content_type
      FROM content_translations ctx
      LEFT JOIN content c ON c.id::text = ctx.entity_id
      WHERE ctx.body IS NOT NULL`;
    for (const row of translationRows) {
      if (!row.content_type) continue; // orphaned translation row — not our concern here
      const newBody = rewriteBody(row.body, row.content_type, moved);
      if (newBody !== row.body) {
        await sql`UPDATE content_translations SET body=${newBody} WHERE id=${row.id}`;
        translationRowsUpdated++;
      }
    }

    let vehicleRowsUpdated = 0;
    for (const row of vehicleRows) {
      let coverImage = row.cover_image, ogImage = row.og_image;
      let changed = false;
      if (coverImage && moved.has(coverImage)) { coverImage = moved.get(coverImage).newUrl; changed = true; }
      if (ogImage && moved.has(ogImage)) { ogImage = moved.get(ogImage).newUrl; changed = true; }
      let galleryChanged = false;
      const newGallery = (row.gallery ?? []).map((item) => {
        if (item?.url && moved.has(item.url)) { galleryChanged = true; return { ...item, url: moved.get(item.url).newUrl }; }
        return item;
      });
      if (galleryChanged) changed = true;
      if (changed) {
        await sql`UPDATE vehicles SET cover_image=${coverImage}, og_image=${ogImage}, gallery=${sql.json(newGallery)}, updated_at=now() WHERE id=${row.id}`;
        vehicleRowsUpdated++;
      }
    }

    let studioProjectRowsUpdated = 0;
    for (const row of studioProjectRows) {
      if (row.cover_image_url && moved.has(row.cover_image_url)) {
        await sql`UPDATE studio_projects SET cover_image_url=${moved.get(row.cover_image_url).newUrl}, updated_at=now() WHERE id=${row.id}`;
        studioProjectRowsUpdated++;
      }
    }

    let studioImageRowsUpdated = 0;
    for (const row of studioImageRows) {
      const url = row.url ?? (row.object_path ? `${OBJ_PREFIX}${row.object_path}` : null);
      if (url && moved.has(url)) {
        const plan = moved.get(url);
        await sql`UPDATE studio_images SET object_path=${plan.newObjectName}, url=${plan.newUrl}, updated_at=now() WHERE id=${row.id}`;
        studioImageRowsUpdated++;
      }
    }

    let routeRowsUpdated = 0;
    for (const row of routeRows) {
      if (row.image_path && moved.has(row.image_path)) {
        await sql`UPDATE transfer_routes SET image_path=${moved.get(row.image_path).newUrl}, updated_at=now() WHERE id=${row.id}`;
        routeRowsUpdated++;
      }
    }

    console.log(`\nDB rows updated: content=${contentRowsUpdated}, content_translations=${translationRowsUpdated}, vehicles=${vehicleRowsUpdated}, studio_projects=${studioProjectRowsUpdated}, studio_images=${studioImageRowsUpdated}, transfer_routes=${routeRowsUpdated}`);

    // ── PASS 5: delete old keys now that every DB reference points to the new one ──
    let deleted = 0;
    for (const [, plan] of moved) {
      try {
        const delUrl = await signUrl(bucket, [prefix, plan.oldObjectName].filter(Boolean).join('/'), 'DELETE');
        const del = await fetch(delUrl, { method: 'DELETE', signal: AbortSignal.timeout(30_000) });
        if (del.ok || del.status === 404) deleted++;
        else console.log(`  ! could not delete old key ${plan.oldObjectName} (${del.status}) — left in place, harmless orphan`);
      } catch (err) {
        console.log(`  ! could not delete old key ${plan.oldObjectName}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`Old keys deleted: ${deleted}/${moved.size}`);

    console.log(`\nDone. ${moved.size} image(s) renamed.\n`);
    console.log('New filenames:');
    for (const [, plan] of moved) console.log(`  ${plan.newObjectName}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
