/**
 * Hero image generation script — run from artifacts/istanbul-vip-transfer/
 *
 * Generates DALL-E 3 images for all 14 service pages and uploads them to
 * object storage via the Replit storage sidecar.
 *
 * Usage:
 *   cd artifacts/istanbul-vip-transfer
 *   node scripts/generate-hero-images.mjs
 *
 * Set FORCE=1 to regenerate images that already have a non-placeholder heroImage.
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

const PLACEHOLDER = '/images/istanbul-vip-transfer-hero.webp';
const SIDECAR     = 'http://127.0.0.1:1106';
const FORCE       = process.env.FORCE === '1';

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const ai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Per-service prompts ───────────────────────────────────────────────────────

const SERVICE_PROMPTS = {
  'istanbul-havalimani-transfer':
    'Cinematic exterior shot of a sleek black Mercedes Vito luxury minivan waiting at Istanbul Airport (IST) terminal entrance at golden hour. Istanbul skyline faintly visible in background. Professional VIP driver in suit stands beside vehicle. No text. Ultra-realistic, 16:9, premium travel photography.',
  'sabiha-gokcen-havalimani-transfer':
    'Elegant black Mercedes Sprinter VIP minivan at Sabiha Gökçen Airport, Anatolian hills and blue sky in background. Professional chauffeur in suit, door open ready for guests. No text. Ultra-realistic 16:9 luxury travel photography.',
  'kurumsal-vip-transfer':
    'Corporate executive arriving at a modern Istanbul glass office tower, greeted by uniformed chauffeur beside a black Mercedes Vito with tinted windows. City skyline at dusk. No text. Ultra-realistic 16:9 premium business travel photography.',
  'vip-transfer':
    'Aerial cinematic view of a luxury black Mercedes Vito driving across the Bosphorus Bridge at sunset, Istanbul city lights reflecting on the water below. No text. Ultra-realistic 16:9 luxury VIP travel photography.',
  'sehir-ici-transfer':
    'Luxury black Mercedes Vito navigating Istanbul\'s historic Sultanahmet district, Blue Mosque visible in background, warm evening light. Professional chauffeur-driven service. No text. Ultra-realistic 16:9.',
  'sehirler-arasi-transfer':
    'Elegant black Mercedes Sprinter VIP on a scenic Turkish highway through rolling hills and coastal landscape between cities at sunrise. No text. Ultra-realistic 16:9 luxury intercity transfer photography.',
  'otel-transfer':
    'Luxury black Mercedes Vito parked at the grand entrance of a 5-star Istanbul hotel on the Bosphorus waterfront. Uniformed doorman and chauffeur, hotel lit at blue hour. No text. Ultra-realistic 16:9.',
  'soforlu-arac-kiralama':
    'Professional chauffeur in dark suit holding a name sign, standing beside a polished black Mercedes Vito inside Istanbul\'s modern Galataport terminal. Clean, premium atmosphere. No text. Ultra-realistic 16:9.',
  'saglik-turizmi-transfer':
    'Elegant black Mercedes Vito outside a modern private hospital in Istanbul, professional driver assisting a passenger. Calm, reassuring medical tourism setting. No text. Ultra-realistic 16:9.',
  'istanbul-gunubirlik-turlar':
    'Luxury black Mercedes Sprinter parked near the iconic Hagia Sophia with Sultanahmet skyline at sunrise. Passengers admiring the view. Premium Istanbul day tour atmosphere. No text. Ultra-realistic 16:9.',
  'istanbul-bursa-transfer':
    'Luxury black Mercedes Vito on a scenic route with the Sea of Marmara visible, heading toward Bursa, snow-capped Uludağ in background. No text. Ultra-realistic 16:9.',
  'istanbul-sapanca-transfer':
    'Elegant black Mercedes VIP vehicle arriving at the tranquil Sapanca Lake shore lined with lush green trees and misty mountains. Luxury nature escape transfer. No text. Ultra-realistic 16:9.',
  'sapanca-masukiye-turu':
    'Luxury black Mercedes Vito parked at a boutique forest resort near Maşukiye waterfall, Sapanca region. Lush greenery, wooden cabin in background, peaceful atmosphere. No text. Ultra-realistic 16:9.',
  'bursa-gunubirlik-tur':
    'Luxury black Mercedes VIP minivan near Bursa\'s iconic Green Mosque (Yeşil Cami) with Uludağ mountain in background, golden afternoon light. Premium day tour. No text. Ultra-realistic 16:9.',
  'yalova-gunubirlik-tur':
    'Luxury black Mercedes Vito at Yalova ferry terminal on the Sea of Marmara, Istanbul skyline visible across the water, soft morning light. VIP day trip atmosphere. No text. Ultra-realistic 16:9.',
};

const DEFAULT_PROMPT = (slug) =>
  `Professional luxury black Mercedes VIP vehicle at a scenic Istanbul landmark, Bosphorus Strait visible, golden hour light. Service: ${slug}. No text. Ultra-realistic 16:9 premium travel photography.`;

// ── Storage upload helpers ─────────────────────────────────────────────────────

function parsePrivateDir(dir) {
  if (!dir) return null;
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  const slash = cleaned.indexOf('/');
  if (slash === -1) return { bucketName: cleaned, prefix: '' };
  return { bucketName: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

async function uploadToStorage(imageBuffer, entityId) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    console.warn('  PRIVATE_OBJECT_DIR not set — cannot upload to storage');
    return null;
  }

  const storage = parsePrivateDir(privateDir);
  if (!storage) return null;

  const objectName = [storage.prefix, entityId].filter(Boolean).join('/');
  const expiresAt  = new Date(Date.now() + 900_000).toISOString();

  const signRes = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: storage.bucketName,
      object_name: objectName,
      method: 'PUT',
      expires_at: expiresAt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!signRes.ok) {
    const text = await signRes.text();
    throw new Error(`Sidecar sign failed ${signRes.status}: ${text.slice(0, 200)}`);
  }

  const { signed_url } = await signRes.json();

  const putRes = await fetch(signed_url, {
    method: 'PUT',
    body: imageBuffer,
    headers: { 'Content-Type': 'image/jpeg' },
    signal: AbortSignal.timeout(60_000),
  });

  if (!putRes.ok) throw new Error(`Storage PUT failed: ${putRes.status}`);

  return `/api/storage/objects/${entityId}`;
}

// ── Generate one service page image ──────────────────────────────────────────

async function generateForService(svc) {
  const label = svc.slug;
  console.log(`\n  [${label}]`);

  if (!FORCE && svc.hero_image && svc.hero_image !== PLACEHOLDER) {
    console.log(`    Skipped — already has custom heroImage: ${svc.hero_image}`);
    return { slug: label, status: 'skipped' };
  }

  const prompt = SERVICE_PROMPTS[svc.slug] ?? DEFAULT_PROMPT(svc.slug);
  console.log(`    Prompt: "${prompt.slice(0, 80)}..."`);

  // Generate with DALL-E 3
  const genRes = await ai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1792x1024',
    quality: 'standard',
  }, { signal: AbortSignal.timeout(90_000) });

  const tempUrl = genRes.data?.[0]?.url;
  if (!tempUrl) throw new Error('No image URL in DALL-E response');
  console.log(`    Generated OK — downloading...`);

  // Download from OpenAI CDN
  const imgRes = await fetch(tempUrl, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  console.log(`    Downloaded ${(imgBuffer.byteLength / 1024).toFixed(0)} KB`);

  // Upload to storage
  const entityId = `service-pages/${svc.slug}/${Date.now()}.jpg`;
  let serveUrl;
  try {
    serveUrl = await uploadToStorage(imgBuffer, entityId);
    if (serveUrl) {
      console.log(`    Uploaded → ${serveUrl}`);
    } else {
      // Fallback: store temporary URL (expires in ~1h, but better than placeholder)
      serveUrl = tempUrl;
      console.warn(`    Storage unavailable — storing temp URL (expires ~1h)`);
    }
  } catch (uploadErr) {
    serveUrl = tempUrl;
    console.warn(`    Upload failed (${uploadErr.message}) — storing temp URL`);
  }

  // Update DB
  await sql`
    UPDATE content
    SET hero_image = ${serveUrl}, updated_at = now()
    WHERE id::text = ${svc.id}
  `;
  console.log(`    ✓ heroImage updated in DB`);

  return { slug: label, status: 'ok', serveUrl };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

  console.log('═══════════════════════════════════════');
  console.log('Hero Image Generation — 14 service pages');
  console.log('═══════════════════════════════════════');
  console.log(`FORCE=${FORCE} (set FORCE=1 to regenerate existing custom images)`);

  // Get service page IDs via content_translations
  const svcIdRows = await sql`SELECT DISTINCT entity_id FROM content_translations WHERE entity_type = 'service_page'`;
  const svcIds = svcIdRows.map(r => r.entity_id);

  const services = await sql`
    SELECT id::text, slug, hero_image FROM content
    WHERE id::text = ANY(${svcIds})
    ORDER BY slug
  `;
  console.log(`\nFound ${services.length} service pages`);

  const results = { ok: [], skipped: [], failed: [] };

  // Generate one at a time (DALL-E 3 rate limits)
  for (const svc of services) {
    try {
      const r = await generateForService(svc);
      if (r.status === 'skipped') results.skipped.push(svc.slug);
      else results.ok.push(svc.slug);
    } catch (err) {
      console.error(`  ✗ ${svc.slug}: ${err.message}`);
      results.failed.push(svc.slug);
    }
    // Brief pause to respect rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`Done: ${results.ok.length} generated, ${results.skipped.length} skipped, ${results.failed.length} failed`);
  if (results.ok.length)      console.log(`  OK:      ${results.ok.join(', ')}`);
  if (results.skipped.length) console.log(`  Skipped: ${results.skipped.join(', ')}`);
  if (results.failed.length)  console.log(`  Failed:  ${results.failed.join(', ')}`);

  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await sql.end();
  process.exit(1);
});
