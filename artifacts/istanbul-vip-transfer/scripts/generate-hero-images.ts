/**
 * GPT Image 2 hero batch generator.
 * Usage: npm run generate:hero-images [-- --target=service|blog] [--dry-run]
 * Blog briefs live in blog-hero-image-config.json; copy its adjacent example
 * entry and provide an explicit prompt and altText. There is no prompt fallback.
 */
import postgres from 'postgres';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getOpenAiImageModel } from '../lib/ai/model-config-core';
import { getServiceHeroImageConfig } from '../lib/ai/service-hero-image-config';
import { optimizeGeneratedImage } from '../lib/studio/image-media';
import {
  blogHeroObjectName,
  isBlogHeroEligible,
  mayGenerateAndWrite,
  validateBlogHeroImageConfig,
  type BlogHeroConfigResult,
} from '../lib/ai/blog-hero-image-core';

const PLACEHOLDER = '/images/istanbul-vip-transfer-hero.webp';
const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const FORCE = process.env.FORCE === '1';
const TARGET_ARGUMENT = process.argv.find(argument => argument.startsWith('--target='))?.slice('--target='.length)
  ?? process.env.HERO_IMAGE_TARGET ?? 'service';
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BLOG_CONFIG_PATH = fileURLToPath(new URL('./blog-hero-image-config.json', import.meta.url));

function safeError(error: unknown): string {
  return String(error instanceof Error ? error.message : error)
    .replace(/https?:\/\/\S+/gi, '[URL_REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[KEY_REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 300);
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP';
}

async function responseBytes(image: { b64_json?: string | null; url?: string | null }): Promise<Uint8Array> {
  if (image.b64_json) {
    const bytes = new Uint8Array(Buffer.from(image.b64_json, 'base64'));
    if (bytes.length && bytes.length <= MAX_IMAGE_BYTES && isWebp(bytes)) return bytes;
    throw new Error('Provider returned invalid or oversized WebP image data');
  }
  if (!image.url) throw new Error('Provider returned no image data');
  const response = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
  const type = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase();
  const length = Number(response.headers.get('content-length') ?? 0);
  if (!response.ok || type !== 'image/webp' || (length && length > MAX_IMAGE_BYTES)) {
    throw new Error('Provider image download failed validation');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || !isWebp(bytes)) throw new Error('Provider image bytes failed validation');
  return bytes;
}

function parsePrivateDir(dir: string) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) {
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '';
    return { bucket, prefix: cleaned.replace(/^\/+/, '') };
  }
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function uploadWebp(bytes: Uint8Array, objectName: string): Promise<string> {
  const configured = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!configured) throw new Error('PRIVATE_OBJECT_DIR is not configured');
  const { bucket, prefix } = parsePrivateDir(configured);
  if (!bucket) throw new Error('PRIVATE_OBJECT_DIR is invalid');
  const sign = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket_name: bucket, object_name: [prefix, objectName].filter(Boolean).join('/'), method: 'PUT', expires_at: new Date(Date.now() + 900_000).toISOString() }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!sign.ok) throw new Error(`Storage signing failed (${sign.status})`);
  const signed = await sign.json() as { signed_url?: unknown };
  if (typeof signed.signed_url !== 'string') throw new Error('Storage signing returned an invalid response');
  const uploadBody = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(uploadBody).set(bytes);
  const upload = await fetch(signed.signed_url, {
    method: 'PUT', headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
    body: uploadBody, signal: AbortSignal.timeout(60_000),
  });
  if (!upload.ok) throw new Error(`Storage upload failed (${upload.status})`);
  return `/api/storage/objects/${objectName}`;
}

async function main() {
  if (TARGET_ARGUMENT !== 'service' && TARGET_ARGUMENT !== 'blog') {
    throw new Error('Invalid target. Use --target=service or --target=blog');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!DRY_RUN && !process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const sql = postgres(process.env.DATABASE_URL, { max: 3 });
  const ai = DRY_RUN ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = getOpenAiImageModel();
  const results: Record<'selected' | 'updated' | 'skipped' | 'configFailed' | 'failed', Array<{ slug: string; reason?: string }>> = {
    selected: [], updated: [], skipped: [], configFailed: [], failed: [],
  };
  try {
    console.log(`Hero Image Generation — target=${TARGET_ARGUMENT}, model=${model}, FORCE=${FORCE}, dryRun=${DRY_RUN}`);
    if (TARGET_ARGUMENT === 'blog') {
      let config: Map<string, BlogHeroConfigResult> | null = null;
      let configError: string | null = null;
      try {
        const parsedConfig = validateBlogHeroImageConfig(JSON.parse(readFileSync(BLOG_CONFIG_PATH, 'utf8')));
        if (typeof parsedConfig === 'string') {
          configError = parsedConfig;
        } else {
          config = parsedConfig;
        }
      } catch {
        configError = 'configuration is malformed JSON';
      }
      const blogRows = await sql`
        SELECT id::text, slug, hero_image, hero_image_alt
        FROM content
        WHERE content_type = 'BLOG_POST' AND status = 'PUBLISHED' AND is_active = true
        ORDER BY slug`;
      const blogs = blogRows as unknown as Array<{ id: string; slug: string; hero_image: string | null; hero_image_alt: string | null }>;
      for (const blog of blogs) {
        if (!isBlogHeroEligible(blog.hero_image, blog.hero_image_alt)) {
          results.skipped.push({ slug: blog.slug, reason: 'already has a custom hero image and nonblank alt text' });
          continue;
        }
        if (configError) {
          results.configFailed.push({ slug: blog.slug, reason: configError });
          continue;
        }
        const entry = config?.get(blog.slug);
        if (!entry) {
          results.skipped.push({ slug: blog.slug, reason: 'missing explicit blog configuration; no prompt fallback is used' });
          continue;
        }
        if (entry.kind === 'disabled') {
          results.skipped.push({ slug: blog.slug, reason: entry.reason });
          continue;
        }
        if (entry.kind === 'invalid') {
          results.configFailed.push({ slug: blog.slug, reason: entry.reason });
          continue;
        }
        results.selected.push({ slug: blog.slug });
        if (!mayGenerateAndWrite(DRY_RUN)) continue;
        try {
          console.log(`  [${blog.slug}] generating`);
          const generated = await ai!.images.generate({
            model, prompt: entry.config.prompt, n: 1, size: '1536x1024', output_format: 'webp',
          } as never, { signal: AbortSignal.timeout(90_000) });
          const raw = await responseBytes(generated.data?.[0] ?? {});
          const optimized = await optimizeGeneratedImage(raw);
          if (!optimized || !isWebp(optimized)) throw new Error('Image optimization failed');
          const permanentUrl = await uploadWebp(optimized, blogHeroObjectName(blog.slug, randomUUID()));
          await sql`UPDATE content SET hero_image = ${permanentUrl}, hero_image_alt = ${entry.config.altText}, updated_at = now() WHERE id::text = ${blog.id}`;
          results.updated.push({ slug: blog.slug });
          console.log(`  ✓ ${blog.slug}: updated`);
        } catch (error) {
          const reason = safeError(error);
          results.failed.push({ slug: blog.slug, reason });
          console.error(`  ✗ ${blog.slug}: ${reason}`);
        }
        await new Promise(resolve => setTimeout(resolve, 3_000));
      }
      return;
    }
    const idRows = await sql`SELECT DISTINCT entity_id FROM content_translations WHERE entity_type = 'service_page'`;
    const ids = (idRows as unknown as Array<{ entity_id: string }>).map(row => row.entity_id);
    const serviceRows = await sql`SELECT id::text, slug, hero_image FROM content WHERE id::text = ANY(${ids}) ORDER BY slug`;
    const services = serviceRows as unknown as Array<{ id: string; slug: string; hero_image: string | null }>;
    for (const service of services) {
      const config = getServiceHeroImageConfig(service.slug);
      if (!config) {
        const reason = 'missing explicit prompt or nonempty alt text configuration';
        console.error(`  ✗ ${service.slug}: ${reason}`);
        results.failed.push({ slug: service.slug, reason });
        continue;
      }
      if (!FORCE && service.hero_image && service.hero_image !== PLACEHOLDER) {
        results.skipped.push({ slug: service.slug, reason: 'already has a custom hero image' });
        continue;
      }
      results.selected.push({ slug: service.slug });
      if (!mayGenerateAndWrite(DRY_RUN)) continue;
      try {
        console.log(`  [${service.slug}] generating`);
        const generated = await ai!.images.generate({
          model, prompt: config.prompt, n: 1, size: '1536x1024', output_format: 'webp',
        } as never, { signal: AbortSignal.timeout(90_000) });
        const raw = await responseBytes(generated.data?.[0] ?? {});
        const optimized = await optimizeGeneratedImage(raw);
        if (!optimized || !isWebp(optimized)) throw new Error('Image optimization failed');
        const objectName = `ai-images/service/${service.slug}/${randomUUID()}.webp`;
        const permanentUrl = await uploadWebp(optimized, objectName);
        await sql`UPDATE content SET hero_image = ${permanentUrl}, hero_image_alt = ${config.altText}, updated_at = now() WHERE id::text = ${service.id}`;
        results.updated.push({ slug: service.slug });
        console.log(`  ✓ ${service.slug}: updated`);
      } catch (error) {
        const reason = safeError(error);
        results.failed.push({ slug: service.slug, reason });
        console.error(`  ✗ ${service.slug}: ${reason}`);
      }
      await new Promise(resolve => setTimeout(resolve, 3_000));
    }
  } finally {
    await sql.end();
    console.log(`Done: ${results.selected.length} selected, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.configFailed.length} configuration failures, ${results.failed.length} failed`);
    for (const selected of results.selected) console.log(`  Selected ${selected.slug}`);
    for (const skipped of results.skipped) console.log(`  Skipped ${skipped.slug}: ${skipped.reason}`);
    for (const configFailed of results.configFailed) console.error(`  Configuration failure ${configFailed.slug}: ${configFailed.reason}`);
    for (const failed of results.failed) console.error(`  Failed ${failed.slug}: ${failed.reason}`);
  }
}

main().catch(error => { console.error(`Fatal: ${safeError(error)}`); process.exitCode = 1; });