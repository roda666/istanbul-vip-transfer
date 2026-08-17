/**
 * Bulk translation script — run from artifacts/istanbul-vip-transfer/
 *
 * Tasks:
 *  1. Blog post istanbul-havalimani-transfer-rehberi → EN/DE/RU/AR/FR/ES/IT/NL
 *  2. All 14 service pages → FR/ES/IT/NL (OUTDATED rows updated to PUBLISHED)
 *
 * Usage:
 *   cd artifacts/istanbul-vip-transfer
 *   node scripts/bulk-translate.mjs
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

const BLOG_POST_ID = 'e7c1531a-1775-4efd-a255-135597d6b856';
const BLOG_LANGS   = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];
const SERVICE_LANGS = ['fr', 'es', 'it', 'nl'];

const LANG_NAMES = {
  en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic (Modern Standard Arabic, RTL)',
  fr: 'French',  es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

const PRESERVED = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp', '+90 532 660 08 47',
  'info@istanbulviptransfer.com', '7/24',
];

const sql = postgres(process.env.DATABASE_URL, { max: 5 });
const ai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini';

// ── OpenAI helpers ────────────────────────────────────────────────────────────

async function translateBlogPost(source, targetLang) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const sys = `You are an expert translation engine for luxury VIP transportation content.
Translate Turkish content to ${langName}.
CRITICAL: Keep verbatim (never translate): ${PRESERVED.map(s => `"${s}"`).join(', ')}
Preserve ALL HTML tags — translate only the text inside them.
For Arabic: use Modern Standard Arabic. Wrap LTR inline strings (phone, email, IST, SAW) with \\u202A...\\u202C.
Return ONLY valid JSON with these exact keys: title, slug, excerpt, body, metaTitle, metaDescription, imageAlt.
slug must be URL-safe: lowercase, hyphens only, no special chars.`;

  const user = `Translate this blog post from Turkish to ${langName}:

${JSON.stringify(source, null, 2)}

Return translated JSON with the same 7 keys.`;

  const res = await ai.chat.completions.create({
    model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    response_format: { type: 'json_object' }, temperature: 0.2,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  return JSON.parse(raw);
}

async function translateServiceFields(fields, targetLang) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const sys = `You are an expert translation engine for luxury VIP transportation content.
Translate all JSON values from Turkish to ${langName}.
CRITICAL: Keep ALL keys exactly as-is — translate ONLY values.
Preserve verbatim: ${PRESERVED.map(s => `"${s}"`).join(', ')}
Do NOT translate URLs, slugs, numbers, or email addresses.
For Arabic: Modern Standard Arabic. Wrap LTR inline strings with \\u202A...\\u202C.
Maintain premium, professional tone.
Return ONLY valid JSON with the same keys and translated string values.`;

  const user = `Translate these ${Object.keys(fields).length} service page fields to ${langName}:

${JSON.stringify(fields, null, 2)}

Return translated JSON with identical keys.`;

  const res = await ai.chat.completions.create({
    model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    response_format: { type: 'json_object' }, temperature: 0.2,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  return JSON.parse(raw);
}

// ── Service page body field extraction (replicated from service-page-types.ts) ──

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

// ── Retry wrapper ─────────────────────────────────────────────────────────────

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

// ── Task 1: Blog post translation ─────────────────────────────────────────────

async function translateBlog() {
  console.log('\n═══════════════════════════════════════');
  console.log('TASK 1: Blog post translation');
  console.log('═══════════════════════════════════════');

  const [post] = await sql`
    SELECT id::text, slug, title, excerpt, body, seo_title, seo_description, hero_image_alt
    FROM content
    WHERE id = ${BLOG_POST_ID}
  `;
  if (!post) { console.error('Blog post not found!'); return; }
  console.log(`Source: "${post.title}" (${post.id})`);

  const existing = await sql`
    SELECT target_language_code, status
    FROM content_translations
    WHERE entity_type = 'content' AND entity_id = ${BLOG_POST_ID}
  `;
  const existingMap = Object.fromEntries(existing.map(r => [r.target_language_code, r.status]));

  const toTranslate = BLOG_LANGS.filter(lang => {
    const s = existingMap[lang];
    return !s || s === 'NOT_STARTED' || s === 'OUTDATED' || s === 'DRAFT';
  });

  if (toTranslate.length === 0) {
    console.log('All languages already PUBLISHED — skipping.');
    return;
  }

  console.log(`Languages to translate: ${toTranslate.join(', ')}`);

  const source = {
    title:       post.title,
    slug:        post.slug,
    excerpt:     post.excerpt,
    body:        post.body,
    metaTitle:   post.seo_title,
    metaDescription: post.seo_description,
    imageAlt:    post.hero_image_alt,
  };

  const results = { ok: [], failed: [] };

  // Translate 2 langs at a time
  for (let i = 0; i < toTranslate.length; i += 2) {
    const batch = toTranslate.slice(i, i + 2);
    await Promise.all(batch.map(async (lang) => {
      const label = `blog→${lang}`;
      try {
        console.log(`  Translating ${label}...`);
        const t = await withRetry(() => translateBlogPost(source, lang), label);

        await sql`
          INSERT INTO content_translations (
            entity_type, entity_id, source_language_code, target_language_code,
            status, title, slug, excerpt, body,
            meta_title, meta_description, image_alt,
            is_ai_generated, ai_model, ai_prompt_version,
            draft_at, published_at, updated_at
          ) VALUES (
            'content', ${BLOG_POST_ID}, 'tr', ${lang},
            'PUBLISHED',
            ${t.title ?? null}, ${t.slug ?? null}, ${t.excerpt ?? null}, ${t.body ?? null},
            ${t.metaTitle ?? null}, ${t.metaDescription ?? null}, ${t.imageAlt ?? null},
            true, ${MODEL}, '1.1',
            now(), now(), now()
          )
          ON CONFLICT (entity_type, entity_id, target_language_code)
          DO UPDATE SET
            status = 'PUBLISHED',
            title = EXCLUDED.title, slug = EXCLUDED.slug,
            excerpt = EXCLUDED.excerpt, body = EXCLUDED.body,
            meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
            image_alt = EXCLUDED.image_alt,
            is_ai_generated = true, ai_model = EXCLUDED.ai_model,
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

  console.log(`\nBlog: ${results.ok.length} OK, ${results.failed.length} failed`);
  if (results.failed.length) console.log('  Failed:', results.failed);
}

// ── Task 2: Service page retranslation ────────────────────────────────────────

async function retranslateServices() {
  console.log('\n═══════════════════════════════════════');
  console.log('TASK 2: Service page retranslation (FR/ES/IT/NL)');
  console.log('═══════════════════════════════════════');

  // Get service page IDs via content_translations (avoids content_type enum issue)
  const svcIdRows = await sql`SELECT DISTINCT entity_id FROM content_translations WHERE entity_type = 'service_page'`;
  const svcIds = svcIdRows.map(r => r.entity_id);
  console.log(`Found ${svcIds.length} service pages`);

  // Get their bodies and metadata from content table
  const services = await sql`
    SELECT id::text, slug, title, seo_title, seo_description, hero_image_alt, body
    FROM content
    WHERE id::text = ANY(${svcIds})
    ORDER BY slug
  `;
  console.log(`Loaded ${services.length} service page sources`);

  // Get only OUTDATED translations (idempotent — already-PUBLISHED rows are skipped)
  const outdated = await sql`
    SELECT id::text, entity_id, target_language_code, status
    FROM content_translations
    WHERE entity_type = 'service_page'
    AND target_language_code = ANY(${SERVICE_LANGS})
    AND status = 'OUTDATED'
    ORDER BY entity_id, target_language_code
  `;
  console.log(`Found ${outdated.length} rows to update`);

  // Build a map: entityId → body
  const bodyMap = Object.fromEntries(services.map(s => [s.id, s]));

  const results = { ok: [], failed: [] };

  // Process 2 at a time per service (lang × service in batches)
  const tasks = outdated.map(row => ({ row, svc: bodyMap[row.entity_id] }))
    .filter(({ svc }) => svc != null);

  console.log(`Processing ${tasks.length} translation tasks...`);

  for (let i = 0; i < tasks.length; i += 2) {
    const batch = tasks.slice(i, i + 2);
    await Promise.all(batch.map(async ({ row, svc }) => {
      const label = `${svc.slug}→${row.target_language_code}`;
      try {
        let parsedBody;
        try { parsedBody = JSON.parse(svc.body); } catch { parsedBody = null; }

        if (!parsedBody || !parsedBody.hero) {
          console.warn(`  ⚠ ${label}: invalid body, skipping`);
          results.failed.push(label + '(invalid body)');
          return;
        }

        const fields = extractTranslatableFields(parsedBody);
        console.log(`  Translating ${label} (${Object.keys(fields).length} fields)...`);

        const translated = await withRetry(
          () => translateServiceFields(fields, row.target_language_code),
          label,
        );

        const translatedBody = applyTranslatedFields(parsedBody, translated);

        await sql`
          UPDATE content_translations SET
            status = 'PUBLISHED',
            title = ${translatedBody.hero?.title ?? null},
            body  = ${JSON.stringify(translatedBody)},
            meta_title = ${translatedBody.seo?.ogTitle ?? svc.seo_title ?? null},
            meta_description = ${translatedBody.seo?.ogDescription ?? svc.seo_description ?? null},
            image_alt = ${svc.hero_image_alt ?? null},
            is_ai_generated = true, ai_model = ${MODEL}, ai_prompt_version = 'sp-1.1',
            draft_at = now(), published_at = now(), updated_at = now()
          WHERE entity_type = 'service_page'
            AND entity_id = ${row.entity_id}
            AND target_language_code = ${row.target_language_code}
        `;
        results.ok.push(label);
        console.log(`  ✓ ${label}`);
      } catch (err) {
        results.failed.push(label);
        console.error(`  ✗ ${label}: ${err.message}`);
      }
    }));
  }

  console.log(`\nServices: ${results.ok.length} OK, ${results.failed.length} failed`);
  if (results.failed.length) console.log('  Failed:', results.failed);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
  if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

  console.log(`Model: ${MODEL}`);
  const start = Date.now();

  await translateBlog();
  await retranslateServices();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ All done in ${elapsed}s`);
  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await sql.end();
  process.exit(1);
});
