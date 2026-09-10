import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const slug = 'istanbul-bogaz-sultanahmet-taksim-tur-rehberi';
const generatedDir = new URL('../../../attached_assets/generated_images/', import.meta.url);
const guard = 'no text, no logos, no brand marks, no readable signage, no visible number plate';
const specs = [
  {
    key: 'hero',
    fileName: 'bogaz-turu-hero.jpg',
    alt: 'Boğaz kıyısında bekleyen VIP şehir turu aracı',
    prompt: 'Photorealistic three-quarter front view of a black premium van parked along a scenic waterfront road with the Bosphorus strait softly visible in the blurred background, soft afternoon light, calm atmosphere. Editorial automotive travel photography, natural colour grading, no text, no logos, no brand emblems, no visible number plate.',
  },
  {
    key: 'inline1',
    fileName: 'sultanahmet-tarihi-yari-turu.jpg',
    alt: 'Sultanahmet tarihi yarımada sokakları',
    prompt: 'Photorealistic wide shot of a completely empty quiet cobblestone street in a historic old-city district at soft morning light, traditional low-rise architecture with domes faintly visible in the distance. Absolutely no vehicles, no parked cars, no motorcycles, no people in close focus. Documentary travel photography, natural colours.',
  },
  {
    key: 'inline2',
    fileName: 'taksim-sehir-merkezi-tur.jpg',
    alt: 'Taksim çevresinde ilerleyen VIP tur aracı',
    prompt: 'Photorealistic image of a modern city avenue at dusk with soft warm street lighting and blurred building facades. A black premium van is visible at a distance in strict side profile moving through a traffic lane, with front and rear bumper areas fully out of view; no license plate surfaces or plate-shaped rectangles anywhere. Other traffic is heavily blurred and cropped so no vehicle fronts or rears are visible. Editorial urban photography, natural colour grading.',
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

async function generate(spec) {
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
  return { ...spec, url: `/api/storage/objects/${objectName}`, bytes: webp.byteLength };
}

async function invalidateCache() {
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const secret = process.env.AUTH_SECRET;
  if (!domain || !secret) throw new Error('Cache invalidation configuration missing');
  const body = JSON.stringify({ slugs: [slug] });
  const signature = createHmac('sha256', secret).update(`blog-cache-revalidation:v1.${body}`).digest('base64url');
  const response = await fetch(`https://${domain}/admin/api/cron/blog-cache-revalidation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-blog-cache-revalidation-signature': signature },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cache invalidation failed (${response.status})`);
}

try {
  console.log(`Generating 3 images with ${model}`);
  const images = await Promise.all(specs.map(generate));
  const byKey = Object.fromEntries(images.map(image => [image.key, image]));
  const result = await sql.begin(async tx => {
    const [blog] = await tx`
      SELECT id, slug, published_at, body
      FROM content
      WHERE slug = ${slug} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!blog) throw new Error('Blog not found');
    let body = blog.body ?? '';
    if (!body.includes('[[IMAGE:inline-1]]') || !body.includes('[[IMAGE:inline-2]]')) {
      throw new Error('Expected image placeholders missing');
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
      WHERE id = ${blog.id}`;

    const languages = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];
    const [existing] = await tx`
      SELECT id FROM translation_jobs
      WHERE entity_type = 'content' AND entity_id = ${blog.id}
        AND status IN ('QUEUED', 'RUNNING', 'PARTIAL')
      ORDER BY created_at DESC LIMIT 1`;
    let jobId = existing?.id;
    if (!jobId) {
      const [job] = await tx`
        INSERT INTO translation_jobs (
          entity_type, entity_id, status, force, total_tasks, completed_tasks, failed_tasks
        ) VALUES ('content', ${blog.id}, 'RUNNING', false, 8, 0, 0)
        RETURNING id`;
      jobId = job.id;
      await tx`
        INSERT INTO translation_job_tasks (job_id, target_language_code, status, attempts)
        SELECT ${jobId}, code, 'QUEUED', 0 FROM unnest(${languages}::text[]) AS code`;
    }
    const tasks = await tx`
      SELECT target_language_code, status FROM translation_job_tasks
      WHERE job_id = ${jobId} ORDER BY target_language_code`;
    return { blogId: blog.id, slug: blog.slug, publishedAt: blog.published_at, jobId, tasks };
  });
  await invalidateCache();
  console.log(JSON.stringify({ model, images: images.map(({ key, fileName, alt, prompt, url, bytes }) => ({ key, fileName, alt, prompt, url, bytes })), ...result }, null, 2));
} finally {
  await sql.end();
}