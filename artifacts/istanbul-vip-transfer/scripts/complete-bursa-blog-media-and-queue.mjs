/**
 * Completes the already-generated Bursa blog media placement and creates the
 * eight-language draft translation queue. Idempotent and safe to re-run.
 */
import { readFile } from 'node:fs/promises';
import postgres from '../node_modules/postgres/src/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const SLUG = 'istanbul-bursa-uludag-inegol-kartepe-transfer';
const LANGUAGES = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];

const IMAGES = [
  {
    key: 'hero',
    sourcePath: '../../../attached_assets/generated_images/bursa-bolgesi-transfer-hero.jpg',
    fileName: 'bursa-bolgesi-transfer-hero.webp',
    alt: 'İstanbul’dan Bursa bölgesine VIP transfer için yola çıkan siyah lüks araç',
  },
  {
    key: 'inline1',
    sourcePath: '../../../attached_assets/generated_images/kopru-feribot-karsilastirma.jpg',
    fileName: 'kopru-feribot-karsilastirma.webp',
    alt: 'İstanbul Bursa transferinde köprü ve feribot güzergâhlarının karşılaştırması',
  },
  {
    key: 'inline2',
    sourcePath: '../../../attached_assets/generated_images/uludag-kayak-transfer.jpg',
    fileName: 'uludag-kayak-transfer.webp',
    alt: 'Uludağ kayak transferinde karlı dağ yolunda ilerleyen VIP araç',
  },
];

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    return {
      bucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '',
      prefix: cleaned.replace(/^\/+/, ''),
    };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0
    ? { bucket: cleaned, prefix: '' }
    : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function optimizeToWebp(sourcePath) {
  const input = await readFile(new URL(sourcePath, import.meta.url));
  const output = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1536, height: 1024, fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer();
  const metadata = await sharp(output).metadata();
  if (metadata.format !== 'webp' || !metadata.width || !metadata.height || output.byteLength === 0) {
    throw new Error(`WebP doğrulaması başarısız: ${sourcePath}`);
  }
  return output;
}

async function uploadWebp(bytes, objectName) {
  const configured = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!configured) throw new Error('PRIVATE_OBJECT_DIR is not configured');
  const { bucket, prefix } = parsePrivateDir(configured);
  if (!bucket) throw new Error('Object storage bucket is not configured');
  const fullObjectName = [prefix, objectName].filter(Boolean).join('/');

  const sign = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: fullObjectName,
      method: 'PUT',
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!sign.ok) throw new Error(`Storage signing failed (${sign.status})`);
  const signed = await sign.json();
  if (typeof signed.signed_url !== 'string') throw new Error('Storage signing response is invalid');

  const upload = await fetch(signed.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  if (!upload.ok) throw new Error(`Storage upload failed (${upload.status})`);
}

async function main() {
  const uploaded = {};
  for (const image of IMAGES) {
    const objectName = `ai-images/blog/${SLUG}/${image.fileName}`;
    const bytes = await optimizeToWebp(image.sourcePath);
    await uploadWebp(bytes, objectName);
    uploaded[image.key] = {
      url: `/api/storage/objects/${objectName}`,
      alt: image.alt,
      bytes: bytes.byteLength,
    };
  }

  const result = await sql.begin(async (tx) => {
    const [blog] = await tx`
      SELECT id, body
      FROM content
      WHERE slug = ${SLUG} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!blog) throw new Error('Bursa blog kaydı bulunamadı');

    let body = blog.body ?? '';
    const inline1Markdown = `![${uploaded.inline1.alt}](${uploaded.inline1.url})`;
    const inline2Markdown = `![${uploaded.inline2.alt}](${uploaded.inline2.url})`;

    if (body.includes('[[IMAGE:inline-1]]')) {
      body = body.replace('[[IMAGE:inline-1]]', inline1Markdown);
    } else if (!body.includes(uploaded.inline1.url)) {
      throw new Error('inline-1 yer tutucusu veya mevcut görsel referansı bulunamadı');
    }
    if (body.includes('[[IMAGE:inline-2]]')) {
      body = body.replace('[[IMAGE:inline-2]]', inline2Markdown);
    } else if (!body.includes(uploaded.inline2.url)) {
      throw new Error('inline-2 yer tutucusu veya mevcut görsel referansı bulunamadı');
    }

    await tx`
      UPDATE content SET
        body = ${body},
        hero_image = ${uploaded.hero.url},
        hero_image_alt = ${uploaded.hero.alt},
        updated_at = now()
      WHERE id = ${blog.id}`;

    const catalog = await tx`
      SELECT code, provider_supported
      FROM languages
      WHERE code = ANY(${LANGUAGES})`;
    const supportedCodes = new Set(
      catalog.filter((row) => row.provider_supported !== false).map((row) => row.code),
    );
    const invalid = LANGUAGES.filter((code) => !supportedCodes.has(code));
    if (invalid.length) throw new Error(`Çeviri kataloğunda desteklenmeyen diller: ${invalid.join(', ')}`);

    const [existingJob] = await tx`
      SELECT id, status
      FROM translation_jobs
      WHERE entity_type = 'content'
        AND entity_id = ${blog.id}
        AND status IN ('QUEUED', 'RUNNING', 'PARTIAL')
      ORDER BY created_at DESC
      LIMIT 1`;

    let jobId = existingJob?.id;
    if (!jobId) {
      const [job] = await tx`
        INSERT INTO translation_jobs (
          entity_type, entity_id, status, force, total_tasks,
          completed_tasks, failed_tasks
        ) VALUES (
          'content', ${blog.id}, 'RUNNING', false, ${LANGUAGES.length},
          0, 0
        )
        RETURNING id`;
      jobId = job.id;
      await tx`
        INSERT INTO translation_job_tasks (
          job_id, target_language_code, status, attempts
        )
        SELECT ${jobId}, language_code, 'QUEUED', 0
        FROM unnest(${LANGUAGES}::text[]) AS language_code`;
    }

    const tasks = await tx`
      SELECT target_language_code, status
      FROM translation_job_tasks
      WHERE job_id = ${jobId}
      ORDER BY target_language_code`;

    return { blogId: blog.id, jobId, tasks };
  });

  console.log(JSON.stringify({ uploaded, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());