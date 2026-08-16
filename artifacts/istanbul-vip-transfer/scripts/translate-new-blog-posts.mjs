/**
 * Translate 12 new blog posts to 8 languages (en, de, ru, ar, es, fr, it, nl).
 *
 * Usage (from artifacts/istanbul-vip-transfer/):
 *   node scripts/translate-new-blog-posts.mjs
 *
 * Idempotent: skips already-PUBLISHED translations, re-runs DRAFT/FAILED ones.
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI   from '../node_modules/openai/index.js';

// ── Config ────────────────────────────────────────────────────────────────────

const TARGET_LANGS = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];

const LANG_NAMES = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  ar: 'Arabic (Modern Standard Arabic, right-to-left)',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  nl: 'Dutch',
};

const NEW_BLOG_SLUGS = [
  'kayak-turlarinda-vip-transfer-rehberi',
  'bodrum-vip-transfer-rehberi',
  'yaz-tatilinde-vip-transfer-secenekleri',
  'otel-transfer-hizmeti-nasil-calisir',
  'havalimani-fuar-kongre-transfer',
  'istanbul-bogaz-sultanahmet-taksim-tur-rehberi',
  'sehirlerarasi-vip-transfer-rehberi',
  'istanbul-bursa-uludag-inegol-kartepe-transfer',
  'istanbul-vip-transfer-fiyatlari-nasil-belirlenir',
  'vito-soforlu-arac-kiralama-rehberi',
  'vip-taksi-ile-standart-taksi-farklari',
  'ankara-vip-transfer-ozel-sofor-rehberi',
];

const PRESERVED = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'Mercedes', 'WhatsApp',
  '+90 532 660 08 47', 'info@istanbulviptransfer.com', '7/24',
  'Kartepe', 'Uludağ', 'Bursa', 'Sapanca', 'Maşukiye',
];

const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
const CONCURRENCY = 2; // simultaneous language translations per article

// ── DB + AI clients ───────────────────────────────────────────────────────────

const sql = postgres(process.env.DATABASE_URL, { max: 4 });
const ai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Translation helper ────────────────────────────────────────────────────────

async function translateBlogPost(source, targetLang) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;

  const sys = `You are an expert translation engine for luxury VIP transportation content.
Translate Turkish content to ${langName}.
CRITICAL rules:
- Keep verbatim (never translate): ${PRESERVED.map(s => `"${s}"`).join(', ')}
- Preserve ALL markdown formatting (##, ###, -, **, *, [text](url)) — translate only the text
- For Arabic: use Modern Standard Arabic. Wrap inline LTR strings (phone numbers, email, codes like IST/SAW) with \\u202A...\\u202C
- slug must be URL-safe: lowercase letters, hyphens only, no accents or special chars
- Maintain premium, professional tone appropriate for luxury transfer services
Return ONLY valid JSON with these exact keys: title, slug, excerpt, body, metaTitle, metaDescription, imageAlt`;

  const user = `Translate this blog post from Turkish to ${langName}:

${JSON.stringify(source, null, 2)}

Return translated JSON with the same 7 keys.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);
  try {
    const res = await ai.chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      },
      { signal: controller.signal }
    );
    const raw = res.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty OpenAI response');
    return JSON.parse(raw);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Chunk helper for concurrency ──────────────────────────────────────────────

async function runInChunks(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(fn));
    results.push(...settled);
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌍 Blog post translation — 12 articles × 8 languages\n');

  // Load all 12 source articles
  const articles = await sql`
    SELECT id, slug, title, excerpt, seo_title, seo_description, hero_image_alt, body
    FROM content
    WHERE content_type = 'BLOG_POST'
      AND slug = ANY(${NEW_BLOG_SLUGS})
    ORDER BY created_at
  `;

  if (articles.length === 0) {
    console.error('❌ No articles found. Run the seed first.');
    process.exit(1);
  }
  console.log(`Found ${articles.length} source articles.\n`);

  let totalOk = 0, totalSkip = 0, totalFail = 0;

  for (const article of articles) {
    console.log(`\n📄 ${article.slug}`);

    const source = {
      title:           article.title,
      slug:            article.slug,
      excerpt:         article.excerpt,
      body:            article.body,
      metaTitle:       article.seo_title,
      metaDescription: article.seo_description,
      imageAlt:        article.hero_image_alt,
    };

    // Check which langs already have a PUBLISHED translation
    const existing = await sql`
      SELECT target_language_code, status
      FROM content_translations
      WHERE entity_type = 'content'
        AND entity_id   = ${article.id}
        AND target_language_code = ANY(${TARGET_LANGS})
    `;
    const doneSet = new Set(existing.filter(r => r.status === 'PUBLISHED').map(r => r.target_language_code));
    const langs   = TARGET_LANGS.filter(l => !doneSet.has(l));

    if (langs.length === 0) {
      console.log(`  ⏭  All 8 languages already PUBLISHED — skipping`);
      totalSkip += 8;
      continue;
    }
    if (doneSet.size > 0) {
      console.log(`  ⏭  Already done: ${[...doneSet].join(', ')} — translating: ${langs.join(', ')}`);
    }

    const results = await runInChunks(langs, CONCURRENCY, async (lang) => {
      process.stdout.write(`  → ${lang}…`);
      const t = await translateBlogPost(source, lang);

      // Apply Arabic RTL markers if needed
      let body = t.body ?? '';
      if (lang === 'ar') {
        body = body.replace(
          /(\+90\s*\d[\d\s\-()]{6,}|\b[A-Z]{2,4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/g,
          '\u202A$1\u202C'
        );
      }

      await sql`
        INSERT INTO content_translations (
          id, entity_type, entity_id, source_language_code, target_language_code,
          status, title, slug, excerpt, body,
          meta_title, meta_description, image_alt,
          is_ai_generated, ai_model,
          published_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'content', ${article.id}, 'tr', ${lang},
          'PUBLISHED', ${t.title ?? source.title}, ${t.slug ?? source.slug},
          ${t.excerpt ?? source.excerpt}, ${body},
          ${t.metaTitle ?? source.metaTitle}, ${t.metaDescription ?? source.metaDescription},
          ${t.imageAlt ?? source.imageAlt},
          true, ${MODEL},
          NOW(), NOW(), NOW()
        )
        ON CONFLICT (entity_type, entity_id, target_language_code)
        DO UPDATE SET
          status       = 'PUBLISHED',
          title        = EXCLUDED.title,
          slug         = EXCLUDED.slug,
          excerpt      = EXCLUDED.excerpt,
          body         = EXCLUDED.body,
          meta_title   = EXCLUDED.meta_title,
          meta_description = EXCLUDED.meta_description,
          image_alt    = EXCLUDED.image_alt,
          is_ai_generated = true,
          ai_model     = EXCLUDED.ai_model,
          published_at = NOW(),
          updated_at   = NOW()
      `;
      process.stdout.write(` ✅\n`);
      return lang;
    });

    const ok   = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected');
    totalOk   += ok;
    totalFail += fail.length;
    fail.forEach(r => console.error(`  ❌ failed: ${r.reason?.message ?? r.reason}`));
  }

  console.log(`\n✅ Done — ${totalOk} translated, ${totalSkip} skipped, ${totalFail} failed`);
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
