#!/usr/bin/env node
/**
 * Build-time warning guard for broken AI image references used by published
 * blog/service pages and their published translations.
 *
 * Each public /api/storage/objects/ai-images/... URL is resolved to its exact
 * object-storage key and requested with a signed GET. Missing or unreadable
 * objects are reported as warnings without failing the build.
 */
import postgres from '../node_modules/postgres/src/index.js';

const OBJ_PREFIX = '/api/storage/objects/';
const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const URL_RE = /\/api\/storage\/objects\/ai-images\/[a-z0-9/_-]+\.webp/gi;
const CONCURRENCY = 8;

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '';
    return { bucket, prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0
    ? { bucket: cleaned, prefix: '' }
    : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function signGetUrl(bucket, objectName) {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method: 'GET',
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`signing failed (${response.status})`);
  const data = await response.json();
  if (typeof data.signed_url !== 'string') throw new Error('invalid signing response');
  return data.signed_url;
}

function imageUrls(raw) {
  return raw ? [...raw.matchAll(URL_RE)].map(match => match[0]) : [];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!privateDir) throw new Error('PRIVATE_OBJECT_DIR not set');
  const { bucket, prefix } = parsePrivateDir(privateDir);
  if (!bucket) throw new Error('PRIVATE_OBJECT_DIR is invalid');

  const sql = postgres(process.env.DATABASE_URL);
  const references = new Map();
  const note = (url, source) => {
    if (!url?.startsWith(`${OBJ_PREFIX}ai-images/`)) return;
    const sources = references.get(url) ?? new Set();
    sources.add(source);
    references.set(url, sources);
  };

  try {
    const contentRows = await sql`
      SELECT id, slug, content_type, hero_image, og_image, body
      FROM content
      WHERE status = 'PUBLISHED'
        AND content_type IN ('BLOG_POST', 'SERVICE')`;
    for (const row of contentRows) {
      const type = row.content_type === 'BLOG_POST' ? 'blog' : 'service';
      note(row.hero_image, `${type}:${row.slug}:hero`);
      note(row.og_image, `${type}:${row.slug}:og`);
      for (const url of imageUrls(row.body)) note(url, `${type}:${row.slug}:body`);
    }

    const translationRows = await sql`
      SELECT ctx.target_language_code, ctx.body, c.slug, c.content_type
      FROM content_translations ctx
      JOIN content c ON c.id::text = ctx.entity_id
      WHERE ctx.status = 'PUBLISHED'
        AND c.status = 'PUBLISHED'
        AND c.content_type IN ('BLOG_POST', 'SERVICE')`;
    for (const row of translationRows) {
      const type = row.content_type === 'BLOG_POST' ? 'blog' : 'service';
      for (const url of imageUrls(row.body)) {
        note(url, `${type}:${row.slug}:${row.target_language_code}:body`);
      }
    }
  } finally {
    await sql.end();
  }

  const entries = [...references.entries()];
  const findings = [];
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const index = cursor++;
      const [url, sources] = entries[index];
      const objectName = [prefix, url.slice(OBJ_PREFIX.length)].filter(Boolean).join('/');
      try {
        const signedUrl = await signGetUrl(bucket, objectName);
        const response = await fetch(signedUrl, { signal: AbortSignal.timeout(20_000) });
        const status = response.status;
        await response.body?.cancel();
        if (status !== 200) findings.push({ url, status, sources: [...sources] });
      } catch (error) {
        findings.push({
          url,
          status: 'request-failed',
          sources: [...sources],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length || 1) }, () => worker()));

  if (findings.length === 0) {
    console.log(`✓ AI image availability check — ${entries.length}/${entries.length} unique published image URLs returned 200.`);
    return;
  }

  console.warn(`⚠ AI image availability check — ${entries.length - findings.length}/${entries.length} returned 200; ${findings.length} broken reference(s):`);
  for (const finding of findings) {
    console.warn(`  ${finding.status} ${finding.url}`);
    console.warn(`    used by: ${finding.sources.join(', ')}`);
    if (finding.error) console.warn(`    error: ${finding.error}`);
  }
}

main().catch(error => {
  console.warn(`⚠ AI image availability check could not run: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 0;
});