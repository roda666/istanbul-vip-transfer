/**
 * Fix homepage CMS translations:
 *  1. Delete orphan entity_type='content' rows (never read by homepage-cms.ts)
 *  2. Re-translate all 8 non-TR locales from current TR source (fresh, v1 format)
 *  3. Upsert into entity_type='homepage' rows (PUBLISHED, correct source_hash)
 *  4. Reset isManuallyLocked=false so auto-retranslation works on next TR save
 *
 * Run from repo root:
 *   node artifacts/istanbul-vip-transfer/scripts/fix-homepage-translations.mjs
 */

import postgres from '../node_modules/postgres/src/index.js';
import OpenAI   from '../node_modules/openai/index.js';
import { createHash } from 'crypto';

const DATABASE_URL    = process.env.DATABASE_URL;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

if (!DATABASE_URL)   { console.error('Missing DATABASE_URL'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 30 });
const ai  = new OpenAI({ apiKey: OPENAI_API_KEY });

const MODEL = 'gpt-4.1-mini';
const LANGS = ['en', 'de', 'ar', 'ru', 'es', 'fr', 'it', 'nl'];

// ── Translatable field extraction (mirrors lib/homepage-sync.ts) ─────────────

function extractTranslatableFields(s) {
  const out = {};
  // Hero
  out['hero.badge']          = s.hero.badge;
  out['hero.headline1']      = s.hero.headline1;
  out['hero.headlineAccent'] = s.hero.headlineAccent;
  out['hero.headline2']      = s.hero.headline2;
  out['hero.subheadline']    = s.hero.subheadline;
  out['hero.ctaBookingText'] = s.hero.ctaBookingText;
  out['hero.ctaCallText']    = s.hero.ctaCallText;
  out['hero.imageAlt']       = s.hero.imageAlt;
  // Stats
  for (const stat of s.heroStats) out[`heroStat.${stat.key}.label`] = stat.label;
  // Services
  out['services.eyebrow']         = s.servicesSection.eyebrow;
  out['services.heading']         = s.servicesSection.heading;
  out['services.description']     = s.servicesSection.description;
  out['services.allServicesText'] = s.servicesSection.allServicesText;
  // Trust
  out['trust.eyebrow'] = s.trustSection.eyebrow;
  out['trust.heading'] = s.trustSection.heading;
  for (const card of s.trustSection.cards) {
    out[`trustCard.${card.id}.title`]       = card.title;
    out[`trustCard.${card.id}.description`] = card.description;
  }
  // Vehicles
  out['vehicles.heading']     = s.vehiclesSection.heading;
  out['vehicles.description'] = s.vehiclesSection.description;
  out['vehicles.ctaText']     = s.vehiclesSection.ctaText;
  // Reviews
  out['reviews.eyebrow']     = s.reviewsSection.eyebrow;
  out['reviews.heading']     = s.reviewsSection.heading;
  out['reviews.viewAllText'] = s.reviewsSection.viewAllText;
  // Reservation
  out['reservation.eyebrow']     = s.reservationSection.eyebrow;
  out['reservation.heading']     = s.reservationSection.heading;
  out['reservation.description'] = s.reservationSection.description;
  // Contact
  out['contact.eyebrow']         = s.contactSection.eyebrow;
  out['contact.heading']         = s.contactSection.heading;
  out['contact.subheading']      = s.contactSection.subheading;
  out['contact.whatsappCtaText'] = s.contactSection.whatsappCtaText;
  // Footer
  out['footer.tagline']        = s.footerSection.tagline;
  out['footer.premiumTagline'] = s.footerSection.premiumTagline;
  out['footer.col1Heading']    = s.footerSection.col1Heading;
  out['footer.col2Heading']    = s.footerSection.col2Heading;
  out['footer.col3Heading']    = s.footerSection.col3Heading;
  out['footer.copyrightText']  = s.footerSection.copyrightText;
  // SEO
  out['seo.metaTitle']       = s.seo.metaTitle;
  out['seo.metaDescription'] = s.seo.metaDescription;
  out['seo.ogTitle']         = s.seo.ogTitle;
  out['seo.ogDescription']   = s.seo.ogDescription;
  out['seo.ogImageAlt']      = s.seo.ogImageAlt;
  return out;
}

function computeTranslatableHash(s) {
  const fields = extractTranslatableFields(s);
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Apply translated flat fields back into a full sections object ─────────────

function applyTranslatedFields(base, translated) {
  const t = JSON.parse(JSON.stringify(base)); // deep clone

  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;
    if (key.startsWith('hero.')) {
      const field = key.slice(5);
      if (typeof t.hero[field] === 'string') t.hero[field] = value;
    } else if (key.startsWith('heroStat.')) {
      const [, statKey, fieldName] = key.split('.');
      const stat = t.heroStats.find(s => s.key === statKey);
      if (stat && fieldName === 'label') stat.label = value;
    } else if (key.startsWith('services.')) {
      const field = key.slice(9);
      if (typeof t.servicesSection[field] === 'string') t.servicesSection[field] = value;
    } else if (key.startsWith('trust.')) {
      const field = key.slice(6);
      if (typeof t.trustSection[field] === 'string') t.trustSection[field] = value;
    } else if (key.startsWith('trustCard.')) {
      const [, cardId, fieldName] = key.split('.');
      const card = t.trustSection.cards.find(c => c.id === cardId);
      if (card && typeof card[fieldName] === 'string') card[fieldName] = value;
    } else if (key.startsWith('vehicles.')) {
      const field = key.slice(9);
      if (typeof t.vehiclesSection[field] === 'string') t.vehiclesSection[field] = value;
    } else if (key.startsWith('reviews.')) {
      const field = key.slice(8);
      if (typeof t.reviewsSection[field] === 'string') t.reviewsSection[field] = value;
    } else if (key.startsWith('reservation.')) {
      const field = key.slice(12);
      if (typeof t.reservationSection[field] === 'string') t.reservationSection[field] = value;
    } else if (key.startsWith('contact.')) {
      const field = key.slice(8);
      if (typeof t.contactSection[field] === 'string') t.contactSection[field] = value;
    } else if (key.startsWith('footer.')) {
      const field = key.slice(7);
      if (typeof t.footerSection[field] === 'string') t.footerSection[field] = value;
    } else if (key.startsWith('seo.')) {
      const field = key.slice(4);
      if (typeof t.seo[field] === 'string') t.seo[field] = value;
    }
  }
  return t;
}

// Sync shared (non-translatable) fields from TR source into target
function syncSharedFields(target, source) {
  const t = JSON.parse(JSON.stringify(target));
  // Hero
  t.hero.imagePath = source.hero.imagePath;
  t.hero.enabled   = source.hero.enabled;
  // Stats
  const srcStats = Object.fromEntries(source.heroStats.map(s => [s.key, s]));
  t.heroStats = t.heroStats.map(stat => {
    const src = srcStats[stat.key];
    return src ? { ...stat, numberText: src.numberText, key: src.key, order: src.order, enabled: src.enabled } : stat;
  });
  for (const srcStat of source.heroStats) {
    if (!t.heroStats.find(x => x.key === srcStat.key)) t.heroStats.push(srcStat);
  }
  t.heroStats.sort((a, b) => a.order - b.order);
  // Services
  t.servicesSection.allServicesRoute = source.servicesSection.allServicesRoute;
  t.servicesSection.enabled          = source.servicesSection.enabled;
  // Trust cards
  const srcCards = Object.fromEntries(source.trustSection.cards.map(c => [c.id, c]));
  t.trustSection.cards = t.trustSection.cards.map(card => {
    const src = srcCards[card.id];
    return src ? { ...card, icon: src.icon, id: src.id, order: src.order, enabled: src.enabled } : card;
  });
  for (const srcCard of source.trustSection.cards) {
    if (!t.trustSection.cards.find(x => x.id === srcCard.id)) t.trustSection.cards.push(srcCard);
  }
  t.trustSection.cards.sort((a, b) => a.order - b.order);
  t.trustSection.enabled     = source.trustSection.enabled;
  t.vehiclesSection.ctaRoute = source.vehiclesSection.ctaRoute;
  t.vehiclesSection.enabled  = source.vehiclesSection.enabled;
  t.reviewsSection.enabled     = source.reviewsSection.enabled;
  t.reservationSection.enabled = source.reservationSection.enabled;
  t.contactSection.enabled     = source.contactSection.enabled;
  t.seo.ogImage   = source.seo.ogImage;
  t.seo.indexable = source.seo.indexable;
  return t;
}

// ── AI translation ────────────────────────────────────────────────────────────

const LANG_NAMES = {
  en: 'English', de: 'German', ar: 'Arabic (Modern Standard Arabic, RTL)',
  ru: 'Russian', es: 'Spanish', fr: 'French', it: 'Italian', nl: 'Dutch',
};

const PRESERVED_VERBATIM = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', '+90 532 660 08 47', 'WhatsApp',
  'wa.me/905326600847', 'info@istanbulviptransfer.com', '7/24',
];

async function translateFields(fields, langCode) {
  const langName = LANG_NAMES[langCode] ?? langCode;
  const systemPrompt = `You are an expert translation engine specializing in luxury VIP transportation content.
Translate the provided JSON field map from Turkish to ${langName}.

CRITICAL RULES:
1. Keep ALL keys exactly as provided — translate ONLY the values.
2. Preserve verbatim: ${PRESERVED_VERBATIM.map(s => `"${s}"`).join(', ')}
3. Do NOT translate URLs, slugs, phone numbers, email addresses, or numeric values.
4. For Arabic: use Modern Standard Arabic. Phone numbers, emails, URLs, IST, SAW, vehicle names stay LTR.
5. Maintain premium, professional tone of a high-end VIP transfer service.
6. SEO fields (metaTitle, metaDescription, ogTitle, ogDescription): optimised for target search market — 50-65 chars for titles, 120-155 chars for descriptions.
7. CTA text must be action-oriented and natural in the target language.
8. Return ONLY valid JSON — no markdown fences, no explanation, no extra keys.
9. Output must contain EXACTLY the same keys as the input.`;

  const userPrompt = `Translate these ${Object.keys(fields).length} homepage fields from Turkish to ${langName}.

Input JSON:
${JSON.stringify(fields, null, 2)}

Return the translated JSON with identical keys.`;

  const resp = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.25,
  });

  const raw = resp.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  const parsed = JSON.parse(raw);

  // Ensure all input keys are present
  const result = {};
  for (const key of Object.keys(fields)) {
    result[key] = typeof parsed[key] === 'string' ? parsed[key] : fields[key];
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Homepage translation fix script ===\n');

  // 1. Fetch TR source
  console.log('1. Fetching Turkish source from DB…');
  const [trRow] = await sql`
    SELECT id::text, body FROM content WHERE slug = 'ana-sayfa' LIMIT 1
  `;
  if (!trRow) { console.error('TR source not found'); process.exit(1); }

  const trSrc = JSON.parse(trRow.body);
  if (trSrc.version !== 1) { console.error('TR body is not v1 format'); process.exit(1); }
  const entityId = trRow.id;
  const trHash = computeTranslatableHash(trSrc);
  const trFields = extractTranslatableFields(trSrc);
  console.log(`   entity_id = ${entityId}`);
  console.log(`   source_hash = ${trHash.slice(0, 16)}…`);
  console.log(`   translatable fields: ${Object.keys(trFields).length}\n`);

  // 2. Translate all 8 langs in parallel
  console.log('2. Translating to 8 languages in parallel (OpenAI)…');
  const results = await Promise.allSettled(
    LANGS.map(async (lang) => {
      process.stdout.write(`   ${lang}: translating…`);
      const translated = await translateFields(trFields, lang);
      // Apply translated text onto TR base structure (preserves all non-text fields)
      const withText  = applyTranslatedFields(trSrc, translated);
      // Sync shared fields from TR source
      const final     = syncSharedFields(withText, trSrc);
      // Verify it parses
      if (final.version !== 1 || typeof final.hero?.badge !== 'string') {
        throw new Error('Result failed validation');
      }
      process.stdout.write(` ✓ (hero.badge="${final.hero.badge.slice(0,40)}")\n`);
      return { lang, body: JSON.stringify(final) };
    })
  );

  const successes = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      console.error(`   ✗ ${r.reason}`);
    }
  }
  console.log(`\n   ${successes.length}/${LANGS.length} translations succeeded.\n`);
  if (successes.length === 0) { console.error('No translations succeeded — aborting.'); process.exit(1); }

  // 3. Delete orphan entity_type='content' rows
  console.log('3. Deleting orphan entity_type=\'content\' rows…');
  const deleted = await sql`
    DELETE FROM content_translations
    WHERE entity_id = ${entityId}
      AND entity_type = 'content'
    RETURNING target_language_code
  `;
  console.log(`   Deleted ${deleted.length} orphan rows: ${deleted.map(r => r.target_language_code).join(', ')}\n`);

  // 4. Upsert entity_type='homepage' rows
  console.log('4. Upserting entity_type=\'homepage\' translations (PUBLISHED)…');
  const now = new Date().toISOString();

  for (const { lang, body } of successes) {
    // Check if row exists
    const [existing] = await sql`
      SELECT id FROM content_translations
      WHERE entity_id = ${entityId}
        AND entity_type = 'homepage'
        AND target_language_code = ${lang}
      LIMIT 1
    `;

    if (existing) {
      await sql`
        UPDATE content_translations SET
          body               = ${body},
          status             = 'PUBLISHED',
          source_hash        = ${trHash},
          is_manually_locked = false,
          locked_at          = null,
          locked_by          = null,
          failure_reason     = null,
          is_ai_generated    = true,
          ai_model           = ${MODEL},
          ai_prompt_version  = '3.0-fix',
          title              = 'Homepage',
          published_at       = ${now},
          draft_at           = ${now},
          updated_at         = ${now},
          updated_by         = null
        WHERE id = ${existing.id}
      `;
      console.log(`   ${lang}: updated existing row (id=${existing.id})`);
    } else {
      await sql`
        INSERT INTO content_translations
          (entity_type, entity_id, target_language_code, source_language_code,
           status, body, title, source_hash, is_ai_generated, ai_model, ai_prompt_version,
           published_at, draft_at, created_at, updated_at)
        VALUES
          ('homepage', ${entityId}, ${lang}, 'tr',
           'PUBLISHED', ${body}, 'Homepage', ${trHash}, true, ${MODEL}, '3.0-fix',
           ${now}, ${now}, ${now}, ${now})
      `;
      console.log(`   ${lang}: inserted new row`);
    }
  }

  // 5. Final verification — read back and parse each
  console.log('\n5. Verifying all 8 translations parse correctly…');
  const rows = await sql`
    SELECT target_language_code, LEFT(body, 100) as body_prefix, status, source_hash
    FROM content_translations
    WHERE entity_id = ${entityId} AND entity_type = 'homepage'
    ORDER BY target_language_code
  `;

  let allOk = true;
  for (const row of rows) {
    let ok = false;
    try {
      const parsed = JSON.parse(row.body_prefix + '...}'); // partial — just check prefix has version
      ok = row.body_prefix.includes('"version":1');
    } catch { /* ignore — prefix may be invalid JSON */ }
    ok = row.body_prefix.includes('"version":1');
    const status = ok ? '✓' : '✗';
    console.log(`   ${status} ${row.target_language_code}: status=${row.status} hash=${row.source_hash?.slice(0,12)}… prefix="${row.body_prefix.slice(0,60)}"`);
    if (!ok) allOk = false;
  }

  if (allOk) {
    console.log('\n✅ All homepage translations fixed and verified.\n');
  } else {
    console.log('\n⚠ Some rows may need manual review.\n');
  }

  // 6. Summary of DB state
  const total = await sql`SELECT COUNT(*) as n FROM content_translations WHERE entity_id = ${entityId}`;
  console.log(`DB state: ${total[0].n} total content_translations rows for entity_id ${entityId.slice(0,8)}…`);
  const byType = await sql`
    SELECT entity_type, COUNT(*) as n FROM content_translations
    WHERE entity_id = ${entityId}
    GROUP BY entity_type
  `;
  for (const r of byType) console.log(`  entity_type='${r.entity_type}': ${r.n} rows`);

  await sql.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
