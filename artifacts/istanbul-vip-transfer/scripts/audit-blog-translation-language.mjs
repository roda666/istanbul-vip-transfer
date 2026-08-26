/**
 * Audits every published localized blog post for Turkish prose that should
 * have been translated. This is intentionally a read-only, report-producing
 * script; content corrections are a separate explicit action.
 */
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.mjs';
import { writeFile } from 'node:fs/promises';

const sql = postgres(process.env.DATABASE_URL);
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL
  || process.env.OPENAI_TRANSLATION_MODEL
  || process.env.OPENAI_CONTENT_MODEL
  || 'gpt-5.4-mini';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspect(row) {
  const payload = {
    language: row.lang,
    sourceSlug: row.source_slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    imageAlt: row.image_alt,
  };

  const system = `You are a strict multilingual editorial quality checker.
Determine whether a translated Turkish travel article contains an untranslated Turkish grammatical phrase, sentence, or paragraph in a displayed text field. Check title, excerpt, body, meta title, meta description, and image alt. It may be embedded within another language.

Do NOT flag proper names, airport codes, vehicle models, brand names, Turkish place names, or link URLs. Specifically allow Sabiha Gökçen, Taksim, Sultanahmet, Istanbul/İstanbul, Vito, Sprinter, Mercedes, VIP, IST, SAW, Türkiye/Turkiye when used only as a name. Flag Turkish prose such as Turkish verb endings, function words, or sentence construction.

Return only JSON:
{"hasUntranslatedTurkish":boolean,"findings":[{"field":"title|excerpt|body|metaTitle|metaDescription|imageAlt","exactText":"verbatim minimum Turkish-containing phrase","reason":"short explanation"}]}

If clean, findings must be [].`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 800,
      });
      const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
      return {
        id: row.id,
        lang: row.lang,
        sourceSlug: row.source_slug,
        title: row.title,
        ...parsed,
      };
    } catch (error) {
      if (attempt === 4) {
        return {
          id: row.id,
          lang: row.lang,
          sourceSlug: row.source_slug,
          title: row.title,
          auditError: error instanceof Error ? error.message : String(error),
        };
      }
      await sleep(1_000 * attempt);
    }
  }
}

try {
  const rows = await sql`
    SELECT ct.id, ct.target_language_code AS lang, c.slug AS source_slug,
           ct.title, ct.excerpt, ct.body, ct.meta_title, ct.meta_description, ct.image_alt
    FROM content_translations ct
    JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.entity_type = 'content'
      AND c.content_type = 'BLOG_POST'
      AND ct.status = 'PUBLISHED'
    ORDER BY ct.target_language_code, c.slug
  `;

  if (rows.length !== 144) {
    throw new Error(`Expected 144 published blog translations, received ${rows.length}`);
  }

  const queue = [...rows];
  const results = [];
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      const result = await inspect(row);
      results.push(result);
      process.stdout.write(
        `${results.length}/${rows.length} ${row.lang}/${row.source_slug} ${
          result.hasUntranslatedTurkish ? 'FLAG' : result.auditError ? 'ERROR' : 'ok'
        }\n`,
      );
    }
  });
  await Promise.all(workers);

  const report = {
    model,
    scanned: rows.length,
    flagged: results.filter((result) => result.hasUntranslatedTurkish).length,
    errors: results.filter((result) => result.auditError).length,
    results: results.sort((a, b) =>
      `${a.lang}/${a.sourceSlug}`.localeCompare(`${b.lang}/${b.sourceSlug}`),
    ),
  };
  await writeFile('/tmp/blog-translation-language-audit.json', JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    scanned: report.scanned,
    flagged: report.flagged,
    errors: report.errors,
    findings: report.results.filter((result) => result.hasUntranslatedTurkish || result.auditError),
  }, null, 2));
} finally {
  await sql.end();
}