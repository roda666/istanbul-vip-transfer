import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const model = 'gpt-image-2';
const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const slug = 'otel-transfer-hizmeti-nasil-calisir';
const generatedDir = new URL('../../../attached_assets/generated_images/', import.meta.url);
const guard = 'no text, no logos, no brand marks, no readable signage, no visible number plate';
const specs = [
  {
    key: 'hero',
    fileName: 'otel-transfer-hero.jpg',
    alt: 'Otel girişinde bekleyen VIP transfer aracı',
    prompt: 'Photorealistic three-quarter front view of a black premium van parked under a modern hotel entrance canopy in soft evening light, warm ambient lighting from the entrance, calm and welcoming atmosphere. Editorial hospitality photography, natural colour grading, no text, no logos, no brand emblems, no visible number plate, no readable signage.',
  },
  {
    key: 'inline1',
    fileName: 'otel-karsilama-bagaj.jpg',
    alt: 'Otel transferinde bagaj yükleme',
    prompt: "Photorealistic image of a driver's hands (only hands and forearm visible, no face) loading a suitcase into a black van's open trunk in soft daylight, clean and organised, professional atmosphere. Documentary travel photography, natural colours, no text, no logos, no readable signage.",
  },
  {
    key: 'inline2',
    fileName: 'coklu-durak-grup-transfer.jpg',
    alt: 'Farklı otellere uğrayan grup transferi aracı',
    prompt: 'Photorealistic wide shot of a black Mercedes Sprinter van parked in front of a row of different small boutique hotel entrances on a city street, soft daylight, calm urban atmosphere. Editorial travel photography, natural colour grading, no text, no logos, no readable signage, no number plates.',
  },
].map(spec => ({ ...spec, prompt: `${guard}. ${spec.prompt} ${guard}.` }));

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    return { bucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '', prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

function imageUrl(spec) {
  return `/api/storage/objects/ai-images/blog/${slug}/${spec.fileName.replace(/\.jpg$/i, '.webp')}`;
}

async function upload(bytes, objectName) {
  const configured = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!configured) throw new Error('PRIVATE_OBJECT_DIR not configured');
  const { bucket, prefix } = parsePrivateDir(configured);
  if (!bucket) throw new Error('Object storage bucket missing');
  const sign = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: [prefix, objectName].filter(Boolean).join('/'),
      method: 'PUT',
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!sign.ok) throw new Error(`Storage signing failed (${sign.status})`);
  const signed = await sign.json();
  if (typeof signed.signed_url !== 'string') throw new Error('Invalid signing response');
  const response = await fetch(signed.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status})`);
}

async function generateImages() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const images = [];
  for (const spec of specs) {
    if (!spec.prompt.startsWith(guard) || !spec.prompt.endsWith(`${guard}.`)) {
      throw new Error(`Prompt guard missing for ${spec.key}`);
    }
    const response = await ai.images.generate({
      model,
      prompt: spec.prompt,
      n: 1,
      size: '1536x1024',
      output_format: 'jpeg',
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error(`No image data for ${spec.key}`);
    const source = Buffer.from(encoded, 'base64');
    await mkdir(generatedDir, { recursive: true });
    await writeFile(new URL(spec.fileName, generatedDir), source);
    const webp = await sharp(source, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 900, fit: 'cover', position: 'centre', withoutEnlargement: true })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toBuffer();
    const objectName = `ai-images/blog/${slug}/${spec.fileName.replace(/\.jpg$/i, '.webp')}`;
    await upload(webp, objectName);
    images.push({ key: spec.key, fileName: spec.fileName, url: imageUrl(spec), bytes: webp.byteLength });
  }
  console.log(JSON.stringify({ phase: 'generated', model, images }, null, 2));
}

async function invalidateCache() {
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const secret = process.env.AUTH_SECRET;
  if (!domain || !secret) throw new Error('Cache invalidation configuration missing');
  const requestBody = JSON.stringify({ slugs: [slug] });
  const signature = createHmac('sha256', secret)
    .update(`blog-cache-revalidation:v1.${requestBody}`)
    .digest('base64url');
  const response = await fetch(`https://${domain}/admin/api/cron/blog-cache-revalidation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-blog-cache-revalidation-signature': signature,
    },
    body: requestBody,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cache invalidation failed (${response.status})`);
}

async function placeImagesAndQueue() {
  const byKey = Object.fromEntries(specs.map(spec => [spec.key, { ...spec, url: imageUrl(spec) }]));
  const result = await sql.begin(async tx => {
    const [before] = await tx`
      SELECT id, slug, status, published_at, body
      FROM content
      WHERE slug = ${slug} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!before) throw new Error('Blog not found');
    let body = before.body ?? '';
    for (const placeholder of ['[[IMAGE:inline-1]]', '[[IMAGE:inline-2]]']) {
      if (body.split(placeholder).length - 1 !== 1) throw new Error(`${placeholder} missing or duplicated`);
    }
    body = body
      .replace('[[IMAGE:inline-1]]', `![${byKey.inline1.alt}](${byKey.inline1.url})`)
      .replace('[[IMAGE:inline-2]]', `![${byKey.inline2.alt}](${byKey.inline2.url})`);

    await tx`
      UPDATE content SET
        body = ${body},
        hero_image = ${byKey.hero.url},
        hero_image_alt = ${byKey.hero.alt},
        og_image = ${byKey.hero.url},
        updated_at = now()
      WHERE id = ${before.id}`;

    const [activeJob] = await tx`
      SELECT id FROM translation_jobs
      WHERE entity_type = 'content' AND entity_id = ${before.id}
        AND status IN ('QUEUED', 'RUNNING', 'PARTIAL')
      LIMIT 1`;
    if (activeJob) throw new Error('An active translation job already exists');

    const [job] = await tx`
      INSERT INTO translation_jobs (
        entity_type, entity_id, status, force, total_tasks, completed_tasks, failed_tasks
      ) VALUES ('content', ${before.id}, 'RUNNING', false, 8, 0, 0)
      RETURNING id`;
    const languages = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];
    await tx`
      INSERT INTO translation_job_tasks (job_id, target_language_code, status, attempts)
      SELECT ${job.id}, code, 'QUEUED', 0 FROM unnest(${languages}::text[]) AS code`;

    const [after] = await tx`
      SELECT slug, status, published_at, updated_at, hero_image, hero_image_alt, og_image, body
      FROM content WHERE id = ${before.id}`;
    if (after.slug !== before.slug || after.status !== before.status ||
        after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('Protected publication fields changed unexpectedly');
    }
    if (after.body.includes('[[IMAGE:inline-1]]') || after.body.includes('[[IMAGE:inline-2]]')) {
      throw new Error('Image placeholder replacement failed');
    }
    const tasks = await tx`
      SELECT target_language_code, status
      FROM translation_job_tasks WHERE job_id = ${job.id}
      ORDER BY target_language_code`;
    return { jobId: job.id, ...after, tasks };
  });
  await invalidateCache();
  console.log(JSON.stringify({ phase: 'placed-and-queued', model, ...result }, null, 2));
}

try {
  if (process.argv.includes('--generate')) await generateImages();
  else if (process.argv.includes('--place')) await placeImagesAndQueue();
  else throw new Error('Use --generate or --place');
} finally {
  await sql.end();
}