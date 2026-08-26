#!/usr/bin/env node
/**
 * One-off batch tool for "Hizmetler 3. aşama / batch 1" in-content images.
 *
 * Two subcommands, kept separate so a human can visually inspect the
 * generated frame before it is ever written to the database:
 *
 *   node scripts/service-section-image.mjs generate --index=1 --out=/tmp/img1.webp
 *     Calls the OpenAI image model (gpt-image-2 by default, same resolution
 *     helper as production: lib/ai/model-config-core.ts), crops/optimizes to
 *     the same 1600x900 16:9 WebP used by the real hero-image pipeline
 *     (lib/studio/image-media.ts::optimizeGeneratedImage), and saves the
 *     result locally. Nothing is uploaded or written to the DB yet.
 *
 *   node scripts/service-section-image.mjs place --index=1 --file=/tmp/img1.webp
 *     Uploads the ALREADY-ACCEPTED local file to permanent object storage
 *     (same sidecar-signed-URL flow as scripts/generate-hero-images.ts) and
 *     inserts it into content.body.contentSections[].image for the matching
 *     heading. If the heading can't be found, the image is still uploaded
 *     and kept (never deleted) and the script reports the miss.
 *
 * Specs (slug / heading / alt / prompt) are hardcoded below — this is a
 * single-batch tool, not a reusable config-driven generator.
 */
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import sharp from '../node_modules/sharp/dist/index.cjs';

const SIDECAR = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';
const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATED_IMAGE_PIXELS = 40_000_000;
const OUT_W = 1600;
const OUT_H = 900;

const SPECS = [
  {
    index: 1,
    slug: 'istanbul-havalimani-transfer',
    heading: 'Karşılama nerede yapılır?',
    alt: 'Havalimanı geliş salonunda yolcuları araca yönlendiren transfer şoförü',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image inside a modern airport arrivals hall, seen from behind: a chauffeur in a dark charcoal suit walks slightly ahead, pushing a luggage trolley with two plain suitcases, while two travellers follow a few steps behind. Tall glass windows, polished light-grey floor, soft daylight. All surfaces, walls and screens completely blank with no lettering, no signs, no logos. Documentary editorial photography, natural colour grading, faces not the focus, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 2,
    slug: 'sabiha-gokcen-havalimani-transfer',
    heading: 'Gece uçuşları ve erken saat transferleri',
    alt: 'Gece havalimanından ayrılan transfer aracının yolcu koltuğundan görünümü',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic passenger point of view from the rear seat of a premium minivan leaving an airport at night, looking forward through the windscreen past the driver's shoulder. Warm cabin light, wet road ahead reflecting street lamps, terminal lights fading in the side mirror. No road signs, no gantries, no billboards; no badges, emblems or lettering on the dashboard or steering wheel. Cinematic night photography, shallow depth of field, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 3,
    slug: 'vip-transfer',
    heading: 'Neler dahildir?',
    alt: 'VIP transfer aracının açılan arka kapısı ve yolcu için hazırlanan iç mekan',
    prompt: "No text, no logos, no brand marks, no readable signage. Photorealistic close detail of a chauffeur in a dark suit holding open the rear sliding door of a black premium minivan with plain unmarked body panels, hand on the handle, cream leather rear seats visible inside with a plain unlabelled water bottle in the seat-back holder. Soft late-afternoon daylight, clean paved surface. No badges, no emblems, no lettering anywhere on the vehicle, door, bottle or interior. Editorial detail photography, shallow depth of field, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 4,
    slug: 'soforlu-arac-kiralama',
    heading: 'Kullanım biçimleri',
    alt: 'Saatlik ve günlük tahsis için bekleyen şoförlü araç ve şoförü',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image of a chauffeur in a dark suit standing calmly beside a black premium minivan with plain unmarked body panels and no plate-shaped dark rectangles, parked at the kerb of a quiet city street in soft midday light, seen from a distance and slightly from behind so the face is not the focus. Trees and blurred low buildings behind, all facades completely blank with no signs, banners or lettering. Editorial business photography, natural colour grading, no text, no logos, no brand marks, no readable signage, no visible number plate.",
  },
  // ── Batch 2 ──────────────────────────────────────────────────────────────
  {
    index: 5,
    slug: 'otel-transfer',
    heading: 'Otel girişinde nasıl işler?',
    alt: 'Otel girişinde bagajın araçtan alınıp resepsiyona taşınması',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image at the covered entrance of an upscale hotel in soft daylight: a chauffeur in a dark suit lifts two plain hard-shell suitcases from the open rear compartment of a black premium minivan with plain unmarked body panels, onto a plain luggage trolley. Polished paving, tall columns, greenery in planters. All facades, awnings, trolley and luggage surfaces completely blank with no signs, banners, lettering or logos. Editorial hospitality photography, natural colour grading, faces not the focus, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 6,
    slug: 'kurumsal-vip-transfer',
    heading: 'Karşılama ve protokol',
    alt: 'Kurumsal transferde araç içinde yolculuk eden iş insanları',
    prompt: "No text, no logos, no brand marks, no readable signage. Photorealistic interior of the rear cabin of a black premium minivan, two business travellers in dark suits seated in the middle row seen from behind and slightly to the side so faces are not the focus, a plain laptop bag on the seat beside them. Soft daylight through tinted windows, blurred city street outside. No badges, no emblems, no lettering on the seats, trim, bag or any surface. Editorial business photography, shallow depth of field, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 7,
    slug: 'sehirler-arasi-transfer',
    heading: 'Mola ve yol düzeni',
    alt: 'Şehirlerarası yolculukta manzaralı bir noktada verilen mola',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image of a black premium minivan with plain unmarked body panels and no plate-shaped dark rectangles, parked at a quiet roadside viewpoint overlooking rolling green hills in warm late-afternoon light. Two travellers stand a few steps away with their backs to the camera, looking at the view. Empty road curving into the distance. No road signs, no gantries, no billboards, no buildings with lettering. Cinematic travel photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 8,
    slug: 'saglik-turizmi-transfer',
    heading: 'İşlem sonrası dönüşlerde nelere dikkat edilir?',
    alt: 'Araca iniş binişte yolcuya destek olan transfer şoförü',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image of a chauffeur in a dark suit standing beside the open sliding door of a black premium minivan with plain unmarked body panels, offering a supporting hand to an older passenger stepping down onto a clean, level paved surface. Seen from a respectful distance and slightly from behind so faces are not the focus. Calm, dignified, unhurried atmosphere. Soft daylight, blurred greenery behind, all surfaces blank with no lettering or logos. No medical equipment visible. Editorial documentary photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  // ── Batch 3 ──────────────────────────────────────────────────────────────
  {
    index: 9,
    slug: 'istanbul-bursa-transfer',
    heading: 'Hangi güzergâh kullanılır?',
    alt: "Körfez geçişli otoyolda İstanbul'dan Bursa'ya ilerleyen transfer aracı",
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic wide shot of a long modern motorway bridge crossing a wide calm bay in clear morning light, a black premium minivan with plain unmarked body panels and no plate-shaped dark rectangles travelling across it, seen from an elevated side angle with distant green hills beyond the water. Light traffic. No road signs, no gantries, no billboards anywhere. Cinematic travel photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 10,
    slug: 'istanbul-sapanca-transfer',
    heading: 'Villa ve bungalov adreslerinde nelere dikkat edilir?',
    alt: 'Sapanca çevresinde dar ve ağaçlıklı bir yolda ilerleyen transfer aracı',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image of a black premium minivan with plain unmarked body panels and no plate-shaped dark rectangles, moving slowly along a narrow tree-lined country lane with dappled sunlight falling through dense green foliage, low wooden fences and a glimpse of a lake below through the trees. Quiet, unhurried atmosphere. No road signs, no billboards, no buildings with lettering. Editorial travel photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 11,
    slug: 'istanbul-gunubirlik-turlar',
    heading: 'Zamanlama ve kalabalık',
    alt: 'Sabah erken saatte sakin bir tarihi sokakta bekleyen tur aracı',
    prompt: "No text, no logos, no brand marks, no readable signage, no visible number plate. Photorealistic image of an empty historic cobblestone street in early morning light, warm-toned old stone buildings on both sides, long soft shadows, a black premium minivan with plain unmarked body panels and no plate-shaped dark rectangles parked at the kerb. Almost no people, calm and quiet. All facades, shutters and windows completely blank with no signs, banners, menus or lettering. No identifiable monument. Editorial travel photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
  {
    index: 12,
    slug: 'bursa-gunubirlik-tur',
    heading: 'Nereler gezilir?',
    alt: "Bursa'da tarihi han ve çarşı bölgesinin sakin bir avlusu",
    prompt: "No text, no logos, no brand marks, no readable signage. Photorealistic image of a quiet historic Ottoman-era caravanserai courtyard with stone arcades on two levels, a large plane tree in the centre, simple wooden chairs and tables in the shade, soft morning light falling across worn stone paving. A few blurred figures in the distance. All walls, doors, shutters and surfaces completely blank with no signs, boards, menus or lettering anywhere. Editorial travel photography, natural colour grading, no text, no logos, no brand marks, no readable signage.",
  },
];

function isWebp(bytes) {
  return bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP';
}

async function responseBytes(image) {
  if (image?.b64_json) {
    const bytes = new Uint8Array(Buffer.from(image.b64_json, 'base64'));
    if (bytes.length && bytes.length <= MAX_GENERATED_IMAGE_BYTES) return bytes;
    throw new Error('Provider returned invalid or oversized image data');
  }
  if (!image?.url) throw new Error('Provider returned no image data');
  const response = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('Provider image download failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) throw new Error('Provider image bytes failed validation');
  return bytes;
}

/** Same crop/optimize policy as lib/studio/image-media.ts::optimizeGeneratedImage. */
async function optimizeGeneratedImage(bytes) {
  const source = sharp(Buffer.from(bytes), {
    failOn: 'error',
    limitInputPixels: MAX_GENERATED_IMAGE_PIXELS,
    sequentialRead: true,
  });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Could not read image metadata');

  const targetRatio = OUT_W / OUT_H;
  const cropWidth = metadata.width > metadata.height * targetRatio
    ? Math.floor(metadata.height * targetRatio) : metadata.width;
  const cropHeight = metadata.height > metadata.width / targetRatio
    ? Math.floor(metadata.width / targetRatio) : metadata.height;
  const cropLeft = Math.floor((metadata.width - cropWidth) / 2);
  const cropTop = Math.floor((metadata.height - cropHeight) / 2);

  const output = await source
    .rotate()
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize({ width: OUT_W, height: OUT_H, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer();

  const result = await sharp(output, { failOn: 'error', limitInputPixels: MAX_GENERATED_IMAGE_PIXELS }).metadata();
  if (result.format !== 'webp' || !result.width || !result.height || output.byteLength === 0) {
    throw new Error('Image optimization failed validation');
  }
  return new Uint8Array(output);
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

async function uploadWebp(bytes, objectName) {
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
  const signed = await sign.json();
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

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(3).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=')];
  }));
  return args;
}

async function cmdGenerate(args) {
  const spec = SPECS.find(s => String(s.index) === args.index);
  if (!spec) throw new Error(`Unknown --index=${args.index}`);
  if (!args.out) throw new Error('--out is required');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log(`Generating [${spec.index}] ${spec.slug} with model=${MODEL} ...`);
  const generated = await ai.images.generate({
    model: MODEL, prompt: spec.prompt, n: 1, size: '1536x1024', output_format: 'webp',
  }, { signal: AbortSignal.timeout(90_000) });
  const raw = await responseBytes(generated.data?.[0]);
  const optimized = await optimizeGeneratedImage(raw);
  if (!isWebp(optimized)) throw new Error('Optimized output is not valid WebP');
  writeFileSync(args.out, Buffer.from(optimized));
  console.log(`✓ Saved ${args.out} (${optimized.byteLength} bytes, model=${MODEL}, 16:9 ${OUT_W}x${OUT_H} WebP)`);
}

async function cmdPlace(args) {
  const spec = SPECS.find(s => String(s.index) === args.index);
  if (!spec) throw new Error(`Unknown --index=${args.index}`);
  if (!args.file) throw new Error('--file is required');
  const bytes = new Uint8Array(readFileSync(args.file));
  if (!isWebp(bytes)) throw new Error('--file is not a valid WebP');

  const objectName = `ai-images/service/${spec.slug}/section-images/${randomUUID()}.webp`;
  const permanentUrl = await uploadWebp(bytes, objectName);
  console.log(`✓ Uploaded to permanent storage: ${permanentUrl} (${bytes.byteLength} bytes)`);

  const sql = postgres(process.env.DATABASE_URL);
  try {
    const rows = await sql`SELECT id::text, body FROM content WHERE slug = ${spec.slug} AND content_type = 'SERVICE'`;
    if (rows.length === 0) {
      console.log(`✗ No content row found for slug=${spec.slug}; image kept at ${permanentUrl}, NOT deleted.`);
      return;
    }
    const row = rows[0];
    const body = JSON.parse(row.body);
    const sections = body.contentSections ?? [];
    const target = sections.find(s => s.heading.trim() === spec.heading.trim());
    if (!target) {
      console.log(`✗ Heading not found: "${spec.heading}" on slug=${spec.slug}. Image kept permanently at ${permanentUrl}, NOT deleted, NOT attached.`);
      return;
    }
    target.image = { id: randomUUID(), src: permanentUrl, alt: spec.alt };
    body.version = 2;
    await sql`UPDATE content SET body = ${JSON.stringify(body)}, updated_at = now() WHERE id::text = ${row.id}`;
    console.log(`✓ Placed under heading "${spec.heading}" on slug=${spec.slug}: ${permanentUrl}`);
  } finally {
    await sql.end();
  }
}

const [, , cmd] = process.argv;
const args = parseArgs();
if (cmd === 'generate') await cmdGenerate(args);
else if (cmd === 'place') await cmdPlace(args);
else { console.error('Usage: service-section-image.mjs <generate|place> --index=N [--out=path|--file=path]'); process.exit(1); }
