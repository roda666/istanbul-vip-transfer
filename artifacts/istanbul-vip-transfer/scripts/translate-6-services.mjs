/**
 * Translate the 6 new service pages (ankara, antalya, izmir, gelin, protokol, villa)
 * to EN, DE, RU, AR, FR, ES, IT, NL using OpenAI.
 *
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE (idempotent).
 *
 * Usage:
 *   cd artifacts/istanbul-vip-transfer
 *   node scripts/translate-6-services.mjs
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

const TARGET_SLUGS = [
  'ankara-vip-transfer',
  'antalya-vip-transfer',
  'izmir-vip-transfer',
  'gelin-arabasi-kiralama',
  'vip-protokol-secim-araci',
  'gunluk-villa-kiralama',
];

const TARGET_LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

const LANG_NAMES = {
  en: 'English (British)',
  de: 'German (Deutsch)',
  ru: 'Russian (Русский)',
  ar: 'Arabic (Modern Standard Arabic, RTL)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  it: 'Italian (Italiano)',
  nl: 'Dutch (Nederlands)',
};

const PRESERVED = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp',
  '+90 532 660 08 47', 'info@istanbulviptransfer.com', '7/24',
  'Esenboğa', 'Adnan Menderes', 'ADB', 'ESB', 'AYT',
];

const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini';

const sql = postgres(process.env.DATABASE_URL, { max: 3 });
const ai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Field extraction (mirrors lib/service-page-types.ts) ─────────────────────

function extractFields(b) {
  const out = {};
  out['hero.badge']        = b.hero?.badge        ?? '';
  out['hero.title']        = b.hero?.title        ?? '';
  out['hero.subtitle']     = b.hero?.subtitle     ?? '';
  out['hero.crumb']        = b.hero?.crumb        ?? '';
  out['hero.ctaPrimary']   = b.hero?.ctaPrimary   ?? '';
  out['hero.ctaSecondary'] = b.hero?.ctaSecondary ?? '';
  out['seo.ogTitle']       = b.seo?.ogTitle       ?? '';
  out['seo.ogDescription'] = b.seo?.ogDescription ?? '';
  (b.features ?? []).forEach((f, i) => { out[`feature.${i}`] = f; });
  if (b.introBody) out['introBody'] = b.introBody;
  (b.contentSections ?? []).forEach((s, i) => {
    out[`contentSection.${i}.heading`] = s.heading ?? '';
    out[`contentSection.${i}.body`]    = s.body    ?? '';
  });
  if (b.serviceArea) {
    out['serviceArea.title']       = b.serviceArea.title       ?? '';
    out['serviceArea.description'] = b.serviceArea.description ?? '';
    (b.serviceArea.areas ?? []).forEach((a, i) => { out[`serviceArea.area.${i}`] = a; });
  }
  (b.faqs ?? []).forEach((f, i) => {
    out[`faq.${i}.question`] = f.question ?? '';
    out[`faq.${i}.answer`]   = f.answer   ?? '';
  });
  return out;
}

function applyFields(base, translated) {
  const t = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;
    if      (key === 'hero.badge')        t.hero.badge          = value;
    else if (key === 'hero.title')        t.hero.title          = value;
    else if (key === 'hero.subtitle')     t.hero.subtitle       = value;
    else if (key === 'hero.crumb')        t.hero.crumb          = value;
    else if (key === 'hero.ctaPrimary')   t.hero.ctaPrimary     = value;
    else if (key === 'hero.ctaSecondary') t.hero.ctaSecondary   = value;
    else if (key === 'seo.ogTitle')       t.seo.ogTitle         = value;
    else if (key === 'seo.ogDescription') t.seo.ogDescription   = value;
    else if (key === 'introBody')         t.introBody           = value;
    else if (key.startsWith('feature.')) {
      const idx = parseInt(key.slice(8), 10);
      if (!isNaN(idx) && idx < t.features.length) t.features[idx] = value;
    }
    else if (key.startsWith('contentSection.')) {
      const parts = key.split('.');
      if (parts.length === 3 && t.contentSections) {
        const idx = parseInt(parts[1], 10);
        const field = parts[2];
        if (!isNaN(idx) && idx < t.contentSections.length && (field === 'heading' || field === 'body'))
          t.contentSections[idx][field] = value;
      }
    }
    else if (key === 'serviceArea.title' && t.serviceArea)       t.serviceArea.title       = value;
    else if (key === 'serviceArea.description' && t.serviceArea) t.serviceArea.description = value;
    else if (key.startsWith('serviceArea.area.') && t.serviceArea) {
      const idx = parseInt(key.slice('serviceArea.area.'.length), 10);
      if (!isNaN(idx) && idx < t.serviceArea.areas.length) t.serviceArea.areas[idx] = value;
    }
    else if (key.startsWith('faq.') && t.faqs) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const idx = parseInt(parts[1], 10);
        const field = parts[2];
        if (!isNaN(idx) && idx < t.faqs.length && (field === 'question' || field === 'answer'))
          t.faqs[idx][field] = value;
      }
    }
  }
  return t;
}

// ── OpenAI translation ────────────────────────────────────────────────────────

async function translateFields(fields, lang) {
  const langName = LANG_NAMES[lang] ?? lang;
  const sys = `You are an expert translation engine for luxury VIP transportation content.
Translate all JSON values from Turkish to ${langName}.
CRITICAL: Keep ALL keys exactly as-is — translate ONLY values.
Preserve verbatim (never translate): ${PRESERVED.map(s => `"${s}"`).join(', ')}
Do NOT translate URLs, slugs, numbers, or email addresses.
For Arabic: Modern Standard Arabic. Wrap LTR inline strings (phone, email, airport codes) with \\u202A...\\u202C.
Maintain premium, professional tone.
Return ONLY valid JSON with the same keys and translated string values.`;

  const user = `Translate these ${Object.keys(fields).length} service page fields to ${langName}:\n\n${JSON.stringify(fields, null, 2)}\n\nReturn translated JSON with identical keys.`;

  const res = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  return JSON.parse(raw);
}

async function withRetry(fn, label, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`  [retry ${attempt}/${maxAttempts}] ${label}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

  console.log(`Model: ${MODEL}`);
  console.log(`Target services: ${TARGET_SLUGS.join(', ')}`);
  console.log(`Target languages: ${TARGET_LANGS.join(', ')}`);

  // Fetch the 6 service pages from DB
  const services = await sql`
    SELECT id::text, slug, title, excerpt, seo_title, seo_description, hero_image_alt, body
    FROM content
    WHERE slug = ANY(${TARGET_SLUGS})
    ORDER BY slug
  `;
  console.log(`\nFound ${services.length}/6 service pages in DB`);

  if (services.length === 0) {
    console.error('No services found — run the seed first (pnpm db:migrate)');
    await sql.end();
    process.exit(1);
  }

  const results = { ok: [], failed: [] };
  const totalTasks = services.length * TARGET_LANGS.length;
  console.log(`\nTotal translation tasks: ${totalTasks} (${services.length} services × ${TARGET_LANGS.length} languages)`);

  // Check what's already translated (for idempotency reporting)
  const existing = await sql`
    SELECT entity_id, target_language_code, status
    FROM content_translations
    WHERE entity_type = 'service_page'
      AND entity_id = ANY(${services.map(s => s.id)})
      AND target_language_code = ANY(${TARGET_LANGS})
  `;
  const existingSet = new Set(existing.map(r => `${r.entity_id}:${r.target_language_code}`));
  const alreadyDone = existing.filter(r => r.status === 'PUBLISHED').length;
  console.log(`Already PUBLISHED: ${alreadyDone}, will upsert all to ensure completeness\n`);

  // Process each service, 2 languages in parallel
  for (const svc of services) {
    console.log(`\n── ${svc.slug} (${svc.id}) ──`);

    let parsedBody;
    try { parsedBody = JSON.parse(svc.body); }
    catch { console.error(`  ✗ Invalid body JSON for ${svc.slug} — skip`); continue; }

    if (!parsedBody?.hero) {
      console.error(`  ✗ No hero in body for ${svc.slug} — skip`);
      continue;
    }

    const fields = extractFields(parsedBody);
    console.log(`  Fields to translate: ${Object.keys(fields).length}`);

    // 2 languages at a time
    for (let i = 0; i < TARGET_LANGS.length; i += 2) {
      const batch = TARGET_LANGS.slice(i, i + 2);
      await Promise.all(batch.map(async (lang) => {
        const label = `${svc.slug}→${lang}`;
        try {
          console.log(`  Translating ${label}...`);
          const translated = await withRetry(() => translateFields(fields, lang), label);
          const translatedBody = applyFields(parsedBody, translated);

          // For Arabic: wrap the whole body string with RTL context if needed
          // (individual LTR substrings should be wrapped by the LLM itself)

          await sql`
            INSERT INTO content_translations (
              entity_type, entity_id, source_language_code, target_language_code,
              status, title, slug, excerpt, body,
              meta_title, meta_description, image_alt,
              is_ai_generated, ai_model, ai_prompt_version,
              draft_at, published_at, updated_at
            ) VALUES (
              'service_page', ${svc.id}, 'tr', ${lang},
              'PUBLISHED',
              ${translatedBody.hero?.title ?? svc.title ?? null},
              ${svc.slug},
              ${svc.excerpt ?? null},
              ${JSON.stringify(translatedBody)},
              ${translatedBody.seo?.ogTitle ?? svc.seo_title ?? null},
              ${translatedBody.seo?.ogDescription ?? svc.seo_description ?? null},
              ${svc.hero_image_alt ?? null},
              true, ${MODEL}, 'sp-6new-1.0',
              now(), now(), now()
            )
            ON CONFLICT (entity_type, entity_id, target_language_code)
            DO UPDATE SET
              status             = 'PUBLISHED',
              title              = EXCLUDED.title,
              body               = EXCLUDED.body,
              meta_title         = EXCLUDED.meta_title,
              meta_description   = EXCLUDED.meta_description,
              is_ai_generated    = true,
              ai_model           = EXCLUDED.ai_model,
              ai_prompt_version  = EXCLUDED.ai_prompt_version,
              draft_at           = now(),
              published_at       = now(),
              updated_at         = now()
          `;
          results.ok.push(label);
          console.log(`  ✓ ${label}`);
        } catch (err) {
          results.failed.push(label);
          console.error(`  ✗ ${label}: ${err.message}`);
        }
      }));
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Done: ${results.ok.length} OK, ${results.failed.length} failed`);
  if (results.failed.length) {
    console.log('Failed:', results.failed.join(', '));
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  try { await sql.end(); } catch {}
  process.exit(1);
});
