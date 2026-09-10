import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const model = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const slug = 'havalimani-fuar-kongre-transfer';
const generatedDir = new URL('../../../attached_assets/generated_images/', import.meta.url);
const guard = 'no text, no logos, no brand marks, no readable signage, no visible number plate';
const specs = [
  {
    key: 'hero',
    fileName: 'fuar-kongre-transfer-hero.jpg',
    alt: 'Fuar merkezi önünde bekleyen VIP transfer aracı',
    prompt: 'Photorealistic three-quarter front view of a black Mercedes Sprinter-style van parked near a modern glass exhibition center entrance, soft daylight, clean architectural lines blurred in background. The front grille and bumper are plain, continuous and uninterrupted, with absolutely no license plate, no plate holder, no mounting recess and no plate-shaped rectangle. Editorial corporate travel photography, natural colour grading, no text, no logos, no brand emblems, no visible number plate, no readable signage.',
  },
  {
    key: 'inline1',
    fileName: 'kurumsal-grup-transferi.jpg',
    alt: 'Fuar ziyareti için kurumsal grup bagajlarının araca yüklenmesi',
    prompt: "Photorealistic image of a small group of business travelers' luggage (rolling suitcases and laptop bags) neatly lined up beside a black van's open trunk in soft daylight, no faces visible, professional and organised atmosphere. Documentary corporate travel photography, natural colours, no text, no logos, no readable signage.",
  },
  {
    key: 'inline2',
    fileName: 'fuar-takvim-planlama.jpg',
    alt: 'Fuar sezonunda havalimanı terminalinde yoğunluk',
    prompt: 'Photorealistic wide shot of a modern airport terminal departure hall with soft daylight through large windows, blurred travelers with rolling luggage in the distance, calm and orderly atmosphere. Documentary travel photography, natural colours, no text, no logos, no readable signage, no visible faces in close focus.',
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
  const requestedKeys = (process.env.IMAGE_KEYS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const selectedSpecs = requestedKeys.length
    ? specs.filter(spec => requestedKeys.includes(spec.key))
    : specs;
  if (!selectedSpecs.length) throw new Error('No matching IMAGE_KEYS');
  const images = [];
  for (const spec of selectedSpecs) {
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
    images.push({ ...spec, url: imageUrl(spec), bytes: webp.byteLength });
  }
  console.log(JSON.stringify({ phase: 'generated', model, images }, null, 2));
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

async function placeImagesAndQueue() {
  const byKey = Object.fromEntries(specs.map(spec => [spec.key, { ...spec, url: imageUrl(spec) }]));
  const result = await sql.begin(async tx => {
    const [blog] = await tx`
      SELECT id, slug, status, published_at, body
      FROM content
      WHERE slug = ${slug} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!blog) throw new Error('Blog not found');
    let body = blog.body ?? '';
    if ((body.match(/\[\[IMAGE:inline-1\]\]/g) ?? []).length !== 1 ||
        (body.match(/\[\[IMAGE:inline-2\]\]/g) ?? []).length !== 1) {
      throw new Error('Expected image placeholders missing or duplicated');
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
    const [activeJob] = await tx`
      SELECT id FROM translation_jobs
      WHERE entity_type = 'content' AND entity_id = ${blog.id}
        AND status IN ('QUEUED', 'RUNNING', 'PARTIAL')
      ORDER BY created_at DESC LIMIT 1`;
    let jobId = activeJob?.id;
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
    const [after] = await tx`
      SELECT slug, status, published_at, hero_image, hero_image_alt, og_image, body
      FROM content WHERE id = ${blog.id}`;
    if (after.slug !== blog.slug || after.status !== blog.status ||
        after.published_at?.toISOString() !== blog.published_at?.toISOString()) {
      throw new Error('Protected publication fields changed unexpectedly');
    }
    if (after.body.includes('[[IMAGE:inline-1]]') || after.body.includes('[[IMAGE:inline-2]]')) {
      throw new Error('Image placeholder replacement failed');
    }
    return { blogId: blog.id, ...after, jobId, force: false, tasks };
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