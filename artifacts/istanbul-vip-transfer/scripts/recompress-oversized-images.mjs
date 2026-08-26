#!/usr/bin/env node
/**
 * One-time (and re-runnable) backfill: finds every permanent object-storage
 * image referenced anywhere in the DB, and recompresses any WebP larger than
 * the admin-configured threshold (site_settings.image_compression_max_kb).
 *
 * Recompression overwrites the SAME object key (in place), so every public
 * URL and DB reference stays byte-for-byte identical — nothing to update,
 * nothing that can break a link. Only oversized WebP objects are touched;
 * non-WebP or already-small images are left untouched.
 *
 * Usage: node scripts/recompress-oversized-images.mjs [--dry-run]
 */
import postgres from '../node_modules/postgres/src/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const DRY_RUN = process.argv.includes('--dry-run');
const MAX_GENERATED_IMAGE_PIXELS = 40_000_000;
const RECOMPRESS_QUALITY_STEPS = [82, 76, 70, 64];
const OBJ_PREFIX = '/api/storage/objects/';

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '';
    return { bucket, prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

function isWebp(bytes) {
  return bytes.length >= 12
    && Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP';
}

async function recompressToBudget(bytes, maxBytes) {
  if (bytes.byteLength <= maxBytes) return { bytes, recompressed: false };
  let best = bytes;
  for (const quality of RECOMPRESS_QUALITY_STEPS) {
    const candidate = await sharp(Buffer.from(bytes), { failOn: 'error', limitInputPixels: MAX_GENERATED_IMAGE_PIXELS })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
    if (candidate.byteLength === 0) continue;
    if (candidate.byteLength < best.byteLength) best = new Uint8Array(candidate);
    if (candidate.byteLength <= maxBytes) return { bytes: new Uint8Array(candidate), recompressed: true };
  }
  return { bytes: best, recompressed: best.byteLength < bytes.byteLength };
}

/** Collect every /api/storage/objects/... path found in an arbitrary JSON/text blob. */
function extractObjectPaths(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (value.startsWith(OBJ_PREFIX)) {
      out.add(value.trim());
    } else {
      const re = /\/api\/storage\/objects\/[^\s)"'\]]+/g;
      for (const m of value.matchAll(re)) out.add(m[0]);
    }
    return;
  }
  if (Array.isArray(value)) { for (const v of value) extractObjectPaths(v, out); return; }
  if (typeof value === 'object') { for (const v of Object.values(value)) extractObjectPaths(v, out); }
}

function collectFromBody(raw, out) {
  if (!raw) return;
  try {
    extractObjectPaths(JSON.parse(raw), out);
  } catch {
    extractObjectPaths(raw, out); // plain markdown/text body
  }
}

async function findAllObjectPaths(sql) {
  const paths = new Set();

  const contentRows = await sql`SELECT body, draft_body, hero_image, og_image FROM content`;
  for (const row of contentRows) {
    collectFromBody(row.body, paths);
    collectFromBody(row.draft_body, paths);
    extractObjectPaths(row.hero_image, paths);
    extractObjectPaths(row.og_image, paths);
  }

  const vehicleRows = await sql`SELECT cover_image, og_image, gallery FROM vehicles`;
  for (const row of vehicleRows) {
    extractObjectPaths(row.cover_image, paths);
    extractObjectPaths(row.og_image, paths);
    extractObjectPaths(row.gallery, paths);
  }

  const studioProjectRows = await sql`SELECT cover_image_url FROM studio_projects`;
  for (const row of studioProjectRows) extractObjectPaths(row.cover_image_url, paths);

  const studioImageRows = await sql`SELECT object_path, url FROM studio_images`;
  for (const row of studioImageRows) {
    extractObjectPaths(row.object_path, paths);
    extractObjectPaths(row.url, paths);
  }

  const routeRows = await sql`SELECT image_path FROM transfer_routes`;
  for (const row of routeRows) extractObjectPaths(row.image_path, paths);

  return [...paths].filter((p) => p.startsWith(OBJ_PREFIX));
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

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) throw new Error('PRIVATE_OBJECT_DIR not set');
  const { bucket, prefix } = parsePrivateDir(privateDir);
  if (!bucket) throw new Error('PRIVATE_OBJECT_DIR is invalid');

  const sql = postgres(process.env.DATABASE_URL);
  try {
    const settingsRows = await sql`SELECT image_compression_max_kb FROM site_settings WHERE id = 1`;
    const maxKb = settingsRows[0]?.image_compression_max_kb;
    const maxBytes = (typeof maxKb === 'number' && maxKb > 0 ? maxKb : 200) * 1024;
    console.log(`Threshold: ${maxBytes / 1024} KB${DRY_RUN ? ' (dry run)' : ''}`);

    const urls = await findAllObjectPaths(sql);
    console.log(`Scanning ${urls.length} referenced object-storage image(s)...`);

    let overCount = 0;
    let recompressedCount = 0;
    const report = [];

    for (const url of urls) {
      const entityId = url.slice(OBJ_PREFIX.length);
      const objectName = [prefix, entityId].filter(Boolean).join('/');
      try {
        const getUrl = await signUrl(bucket, objectName, 'GET');
        const res = await fetch(getUrl, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) { console.log(`  ✗ ${url}: fetch failed (${res.status})`); continue; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength <= maxBytes) continue;
        overCount++;
        if (!isWebp(bytes)) {
          console.log(`  ! ${url}: ${bytes.byteLength} bytes, over threshold but not WebP — skipped`);
          continue;
        }
        const { bytes: recompressed, recompressed: didRecompress } = await recompressToBudget(bytes, maxBytes);
        if (!didRecompress) {
          console.log(`  ! ${url}: ${bytes.byteLength} bytes, could not shrink below threshold at quality floor — left unchanged`);
          continue;
        }
        if (!DRY_RUN) {
          const putUrl = await signUrl(bucket, objectName, 'PUT');
          const uploadBody = new ArrayBuffer(recompressed.byteLength);
          new Uint8Array(uploadBody).set(recompressed);
          const put = await fetch(putUrl, {
            method: 'PUT', headers: { 'Content-Type': 'image/webp', 'Content-Length': String(recompressed.byteLength) },
            body: uploadBody, signal: AbortSignal.timeout(60_000),
          });
          if (!put.ok) { console.log(`  ✗ ${url}: re-upload failed (${put.status})`); continue; }
        }
        recompressedCount++;
        report.push({ url, before: bytes.byteLength, after: recompressed.byteLength });
        console.log(`  ✓ ${url}: ${bytes.byteLength} → ${recompressed.byteLength} bytes`);
      } catch (err) {
        console.log(`  ✗ ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nDone. ${urls.length} scanned, ${overCount} over threshold, ${recompressedCount} recompressed${DRY_RUN ? ' (dry run, not written)' : ' and overwritten in place'}.`);
    if (report.length) {
      console.log('\nSummary:');
      for (const r of report) console.log(`  ${r.url}\n    ${r.before} → ${r.after} bytes`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
