/**
 * Translates remaining OUTDATED service_page rows for the 14 thin service pages.
 * Skips already-PUBLISHED rows — safe to re-run.
 * Processes 4 tasks at a time for speed.
 */
import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

const sql   = postgres(process.env.DATABASE_URL, { max: 6 });
const ai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';

const TARGET_SLUGS = [
  'istanbul-havalimani-transfer','sabiha-gokcen-havalimani-transfer','vip-transfer',
  'sehirler-arasi-transfer','soforlu-arac-kiralama','otel-transfer','saglik-turizmi-transfer',
  'kurumsal-vip-transfer','istanbul-bursa-transfer','istanbul-sapanca-transfer',
  'istanbul-gunubirlik-turlar','sapanca-masukiye-turu','bursa-gunubirlik-tur','yalova-gunubirlik-tur',
];

const LANG_NAMES = {
  en:'English', de:'German', ru:'Russian', ar:'Arabic (Modern Standard Arabic, RTL)',
  fr:'French',  es:'Spanish', it:'Italian', nl:'Dutch',
};
const PRESERVED = [
  'VIP Transfer Istanbul','Istanbul VIP Transfer','IST','SAW',
  'Mercedes Vito','Mercedes Sprinter','WhatsApp','7/24',
  'Osmangazi Köprüsü','TEM','D100',
];

function extractTranslatableFields(b) {
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
  if (b.contentSections) {
    b.contentSections.forEach((s, i) => {
      out[`contentSection.${i}.heading`] = s.heading ?? '';
      out[`contentSection.${i}.body`]    = s.body    ?? '';
    });
  }
  if (b.serviceArea) {
    out['serviceArea.title']       = b.serviceArea.title       ?? '';
    out['serviceArea.description'] = b.serviceArea.description ?? '';
    (b.serviceArea.areas ?? []).forEach((a, i) => { out[`serviceArea.area.${i}`] = a; });
  }
  if (b.faqs) {
    b.faqs.forEach((f, i) => {
      out[`faq.${i}.question`] = f.question ?? '';
      out[`faq.${i}.answer`]   = f.answer   ?? '';
    });
  }
  return out;
}

function applyTranslatedFields(base, translated) {
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
      if (!isNaN(idx) && t.features && idx < t.features.length) t.features[idx] = value;
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
    else if (key === 'serviceArea.title' && t.serviceArea)       t.serviceArea.title = value;
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

async function translateFields(fields, lang) {
  const langName = LANG_NAMES[lang] ?? lang;
  const res = await ai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: `You are an expert translation engine for luxury VIP transportation content. Translate all JSON values from Turkish to ${langName}. Keep ALL keys as-is. Preserve verbatim: ${PRESERVED.map(s => `"${s}"`).join(', ')}. Do not translate URLs, slugs, numbers. Maintain premium tone. Return ONLY valid JSON with no additional commentary.` },
      { role: 'user', content: `Translate to ${langName}:\n${JSON.stringify(fields, null, 2)}\nReturn translated JSON with identical keys.` },
    ],
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
      console.warn(`  [retry ${attempt}] ${label}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

async function main() {
  const start = Date.now();

  // 1. Get IDs for our target slugs
  const pages = await sql`
    SELECT id::text as id, slug, title, seo_title, seo_description, excerpt, body
    FROM content
    WHERE content_type = 'SERVICE' AND slug = ANY(${TARGET_SLUGS})
    ORDER BY slug
  `;
  console.log(`Loaded ${pages.length} service pages`);

  const bodyMap    = Object.fromEntries(pages.map(p => [p.id, p]));
  const slugToId   = Object.fromEntries(pages.map(p => [p.slug, p.id]));

  // 2. Get all OUTDATED rows for these pages
  const ids = pages.map(p => p.id);
  const outdated = await sql`
    SELECT ct.id::text as ct_id, ct.entity_id, ct.target_language_code
    FROM content_translations ct
    WHERE ct.entity_type = 'service_page'
      AND ct.entity_id = ANY(${ids})
      AND ct.status = 'OUTDATED'
    ORDER BY ct.entity_id, ct.target_language_code
  `;
  console.log(`Found ${outdated.length} OUTDATED translations to process`);

  // 3. Also find missing language rows (INSERT vs UPDATE)
  const existingLangSet = new Set(outdated.map(r => `${r.entity_id}:${r.target_language_code}`));
  const missing = [];
  for (const page of pages) {
    for (const lang of Object.keys(LANG_NAMES)) {
      const key = `${page.id}:${lang}`;
      if (!existingLangSet.has(key)) {
        // Check if PUBLISHED
        const [pub] = await sql`
          SELECT 1 FROM content_translations
          WHERE entity_type = 'service_page' AND entity_id = ${page.id}
            AND target_language_code = ${lang} AND status = 'PUBLISHED'
        `;
        if (!pub) missing.push({ entity_id: page.id, target_language_code: lang });
      }
    }
  }
  console.log(`Found ${missing.length} missing language entries`);

  const tasks = [...outdated, ...missing];
  console.log(`Total tasks: ${tasks.length}`);

  if (tasks.length === 0) {
    console.log('Nothing to do — all translations PUBLISHED.');
    await sql.end();
    return;
  }

  const results = { ok: [], failed: [] };

  // Process 4 at a time
  for (let i = 0; i < tasks.length; i += 4) {
    const batch = tasks.slice(i, i + 4);
    await Promise.all(batch.map(async ({ entity_id, target_language_code: lang }) => {
      const page = bodyMap[entity_id];
      if (!page) { results.failed.push(`${entity_id}→${lang}(no page)`); return; }
      const label = `${page.slug}→${lang}`;
      try {
        let body;
        try { body = JSON.parse(page.body); } catch { body = null; }
        if (!body?.hero) { results.failed.push(label + '(bad body)'); return; }

        const fields = extractTranslatableFields(body);
        const translated = await withRetry(() => translateFields(fields, lang), label);
        const translatedBody = applyTranslatedFields(body, translated);

        await sql`
          INSERT INTO content_translations (
            entity_type, entity_id, source_language_code, target_language_code,
            status, title, slug, excerpt, body, meta_title, meta_description,
            is_ai_generated, ai_model, ai_prompt_version,
            draft_at, published_at, updated_at
          ) VALUES (
            'service_page', ${entity_id}, 'tr', ${lang}, 'PUBLISHED',
            ${translatedBody.hero?.title ?? page.title ?? null},
            ${page.slug + '-' + lang},
            ${page.excerpt ?? null},
            ${JSON.stringify(translatedBody)},
            ${translatedBody.seo?.ogTitle ?? page.seo_title ?? null},
            ${translatedBody.seo?.ogDescription ?? page.seo_description ?? null},
            true, ${MODEL}, 'sp-content-v2',
            now(), now(), now()
          )
          ON CONFLICT (entity_type, entity_id, target_language_code) DO UPDATE SET
            status = 'PUBLISHED', title = EXCLUDED.title, body = EXCLUDED.body,
            meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
            is_ai_generated = true, ai_model = EXCLUDED.ai_model,
            ai_prompt_version = EXCLUDED.ai_prompt_version,
            draft_at = now(), published_at = now(), updated_at = now()
        `;
        results.ok.push(label);
        console.log(`  ✓ ${label}`);
      } catch (err) {
        results.failed.push(label);
        console.error(`  ✗ ${label}: ${err.message}`);
      }
    }));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s — ${results.ok.length} OK, ${results.failed.length} failed`);
  if (results.failed.length) console.log('  Failed:', results.failed);
  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err.message);
  await sql.end();
  process.exit(1);
});
