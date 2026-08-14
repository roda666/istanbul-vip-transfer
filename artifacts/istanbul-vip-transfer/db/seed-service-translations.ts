/**
 * Seed EN/DE/RU/AR translations for all service pages that currently lack them.
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING (idempotent).
 * Translations are seeded as PUBLISHED because the static content they replace
 * was already publicly visible; no review step is required for this migration.
 *
 * Run:  npx tsx db/seed-service-translations.ts
 */
import postgres from 'postgres';
import { createHash } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];
const SERVICE_CONCURRENCY = 2; // services processed in parallel
const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';

const LANG_NAMES: Record<string, string> = {
  en: 'English (British)',
  de: 'German (Deutsch)',
  ru: 'Russian (Русский)',
  ar: 'Arabic (Modern Standard Arabic, RTL)',
  es: 'Spanish (Español, Spain)',
  fr: 'French (Français)',
  it: 'Italian (Italiano)',
  nl: 'Dutch (Nederlands)',
};

const PRESERVED_VERBATIM = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp',
  '+90 532 660 08 47', 'info@istanbulviptransfer.com', '7/24',
];

// ── Types (inlined to avoid server-only / path-alias issues) ──────────────────

interface ServicePageHero {
  badge: string; title: string; subtitle: string;
  crumb: string; ctaPrimary: string; ctaSecondary: string;
}
interface ContentSection { id: string; headingLevel: string; heading: string; body: string; }
interface Faq          { id: string; question: string; answer: string; }
interface ServiceArea  { title: string; description: string; areas: string[]; }

interface ServicePageBody {
  version?: number;
  hero: ServicePageHero;
  features: string[];
  introBody?: string;
  contentSections?: ContentSection[];
  serviceArea?: ServiceArea;
  faqs?: Faq[];
  seo: { ogTitle: string; ogDescription: string };
}

// ── Field helpers (same logic as lib/service-page-types.ts) ───────────────────

function extractFields(b: ServicePageBody): Record<string, string> {
  const out: Record<string, string> = {};
  out['hero.badge']        = b.hero.badge;
  out['hero.title']        = b.hero.title;
  out['hero.subtitle']     = b.hero.subtitle;
  out['hero.crumb']        = b.hero.crumb;
  out['hero.ctaPrimary']   = b.hero.ctaPrimary;
  out['hero.ctaSecondary'] = b.hero.ctaSecondary;
  out['seo.ogTitle']       = b.seo.ogTitle;
  out['seo.ogDescription'] = b.seo.ogDescription;
  b.features.forEach((f, i) => { out[`feature.${i}`] = f; });
  if (b.introBody) out['introBody'] = b.introBody;
  b.contentSections?.forEach((s, i) => {
    out[`contentSection.${i}.heading`] = s.heading;
    out[`contentSection.${i}.body`]    = s.body;
  });
  if (b.serviceArea) {
    out['serviceArea.title']       = b.serviceArea.title;
    out['serviceArea.description'] = b.serviceArea.description;
    b.serviceArea.areas.forEach((a, i) => { out[`serviceArea.area.${i}`] = a; });
  }
  b.faqs?.forEach((f, i) => {
    out[`faq.${i}.question`] = f.question;
    out[`faq.${i}.answer`]   = f.answer;
  });
  return out;
}

function applyFields(base: ServicePageBody, tr: Record<string, string>): ServicePageBody {
  const t: ServicePageBody = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(tr)) {
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
    else if (key.startsWith('contentSection.') && t.contentSections) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const idx = parseInt(parts[1], 10);
        const fld = parts[2] as 'heading' | 'body';
        if (!isNaN(idx) && idx < t.contentSections.length) t.contentSections[idx][fld] = value;
      }
    }
    else if (key === 'serviceArea.title'       && t.serviceArea) t.serviceArea.title       = value;
    else if (key === 'serviceArea.description' && t.serviceArea) t.serviceArea.description = value;
    else if (key.startsWith('serviceArea.area.') && t.serviceArea) {
      const idx = parseInt(key.slice('serviceArea.area.'.length), 10);
      if (!isNaN(idx) && idx < t.serviceArea.areas.length) t.serviceArea.areas[idx] = value;
    }
    else if (key.startsWith('faq.') && t.faqs) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const idx = parseInt(parts[1], 10);
        const fld = parts[2] as 'question' | 'answer';
        if (!isNaN(idx) && idx < t.faqs.length) t.faqs[idx][fld] = value;
      }
    }
  }
  return t;
}

function computeHash(b: ServicePageBody): string {
  const fields = extractFields(b);
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── AI translation ────────────────────────────────────────────────────────────

async function translateFields(
  apiKey: string,
  fields: Record<string, string>,
  locale: string,
): Promise<Record<string, string>> {
  const langName = LANG_NAMES[locale] ?? locale;

  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
`You are an expert translation engine specializing in luxury VIP transportation content.
Translate the provided JSON field map from Turkish to ${langName}.

CRITICAL RULES — NEVER VIOLATE:
1. Keep ALL keys exactly as provided — translate ONLY the values.
2. Preserve verbatim (do not translate): ${PRESERVED_VERBATIM.map(s => `"${s}"`).join(', ')}
3. Do NOT translate URLs, slugs, phone numbers, email addresses, or numeric values.
4. Maintain the premium, professional tone of a high-end VIP transfer service.
5. SEO fields (ogTitle, ogDescription) must be optimized for the target language's search market.
6. CTA text must be action-oriented and natural in the target language.
7. Return ONLY valid JSON — no markdown fences, no explanation, no extra keys.
8. Output must contain EXACTLY the same keys as the input, with translated string values.`,
      },
      {
        role: 'user',
        content: `Translate these ${Object.keys(fields).length} service page fields from Turkish to ${langName}.\n\n${JSON.stringify(fields, null, 2)}\n\nReturn the translated JSON with identical keys.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.25,
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Build result: fall back to TR value if translation is missing or wrong type
  const result: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    const val = parsed[key];
    result[key] = typeof val === 'string' && val.trim() ? val : fields[key];
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl  = process.env.DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!dbUrl)  throw new Error('DATABASE_URL env var is not set.');
  if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set.');

  const sql = postgres(dbUrl, { ssl: false, max: 5 });

  console.log('🔍 Loading service pages from DB…\n');

  // All published active services
  const services = await sql<{
    id: string; slug: string; title: string;
    body: string | null; seo_title: string | null; seo_description: string | null;
  }[]>`
    SELECT id, slug, title, body, seo_title, seo_description
    FROM content
    WHERE content_type = 'SERVICE' AND status = 'PUBLISHED' AND is_active = true
    ORDER BY display_order
  `;

  // Existing translation rows (entity_id × target_language_code)
  const existing = await sql<{ entity_id: string; target_language_code: string }[]>`
    SELECT entity_id, target_language_code
    FROM content_translations
    WHERE entity_type = 'service_page'
      AND target_language_code = ANY(${TARGET_LOCALES})
  `;
  const existingSet = new Set(existing.map(r => `${r.entity_id}::${r.target_language_code}`));

  // Build work list
  const work: { service: typeof services[0]; locale: string }[] = [];
  for (const svc of services) {
    for (const locale of TARGET_LOCALES) {
      if (!existingSet.has(`${svc.id}::${locale}`)) {
        work.push({ service: svc, locale });
      }
    }
  }

  if (work.length === 0) {
    console.log('✅ All EN/DE/RU/AR translations already exist. Nothing to do.\n');
    await sql.end();
    return;
  }

  console.log(`📋 ${work.length} translations to create across ${services.length} services.\n`);

  // Group by service
  const byService = new Map<string, { service: typeof services[0]; locales: string[] }>();
  for (const { service, locale } of work) {
    if (!byService.has(service.id)) byService.set(service.id, { service, locales: [] });
    byService.get(service.id)!.locales.push(locale);
  }

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  // Process services in batches of SERVICE_CONCURRENCY
  const entries = [...byService.values()];

  for (let i = 0; i < entries.length; i += SERVICE_CONCURRENCY) {
    const batch = entries.slice(i, i + SERVICE_CONCURRENCY);

    await Promise.allSettled(batch.map(async ({ service, locales }) => {
      const body = service.body ? (JSON.parse(service.body) as ServicePageBody) : null;
      if (!body) {
        console.log(`  ⚠️  ${service.slug}: no body JSON — skipping`);
        skipped += locales.length;
        return;
      }

      const srcHash = computeHash(body);
      const fields  = extractFields(body);

      // Translate all required locales for this service in parallel
      await Promise.allSettled(locales.map(async (locale) => {
        try {
          const translated     = await translateFields(apiKey, fields, locale);
          const translatedBody = applyFields(body, translated);
          const txTitle        = translated['hero.title']        ?? body.hero.title;
          const txMetaTitle    = translated['seo.ogTitle']       ?? service.seo_title  ?? null;
          const txMetaDesc     = translated['seo.ogDescription'] ?? service.seo_description ?? null;

          // Idempotent insert — skip on conflict (unique: entity_type, entity_id, target_language_code)
          const result = await sql`
            INSERT INTO content_translations (
              entity_type, entity_id,
              source_language_code, target_language_code,
              status, title, body,
              meta_title, meta_description,
              source_hash, is_ai_generated, ai_model,
              created_at, updated_at
            ) VALUES (
              'service_page', ${service.id},
              'tr',           ${locale},
              'PUBLISHED',    ${txTitle},  ${JSON.stringify(translatedBody)},
              ${txMetaTitle}, ${txMetaDesc},
              ${srcHash},     true,         ${MODEL},
              NOW(),          NOW()
            )
            ON CONFLICT (entity_type, entity_id, target_language_code) DO NOTHING
            RETURNING id
          `;

          if (result.length > 0) {
            created++;
            console.log(`  ✅ ${service.slug} [${locale}] created   (${created + skipped + errors}/${work.length})`);
          } else {
            skipped++;
            console.log(`  ⏭  ${service.slug} [${locale}] skipped — already exists`);
          }
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`  ❌ ${service.slug} [${locale}] FAILED: ${msg.slice(0, 120)}`);
        }
      }));
    }));
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`✅  Created : ${created}`);
  console.log(`⏭  Skipped : ${skipped}`);
  console.log(`❌  Errors  : ${errors}`);
  console.log(`${'─'.repeat(56)}\n`);

  await sql.end();

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
