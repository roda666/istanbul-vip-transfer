/**
 * Repairs language-audit findings without ever publishing a failed correction.
 *
 * Uses /tmp/blog-translation-language-audit.json as the initial candidate list,
 * then validates every response before returning it to PUBLISHED. The Istanbul
 * Airport guide additionally receives one verified official-airport link per
 * target language.
 */
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const sql = postgres(process.env.DATABASE_URL);
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL
  || process.env.OPENAI_TRANSLATION_MODEL
  || process.env.OPENAI_CONTENT_MODEL
  || 'gpt-5.4-mini';

const AIRPORT_SOURCE_SLUG = 'istanbul-havalimani-transfer-rehberi';
const AIRPORT_URL = 'https://www.istairport.com/';
const requiredFields = ['title', 'excerpt', 'body', 'metaTitle', 'metaDescription', 'imageAlt'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const links = (value) => [...value.matchAll(/\[[^\]]*]\(([^)\s]+)[^)]*\)/g)].map((match) => match[1]);
const asKey = (values) => [...values].sort().join('\n');

function visibleText(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTurkishGrammar(value) {
  const text = visibleText(value).toLocaleLowerCase('tr-TR');
  const markers = [
    /\b(?:ve|bir|bu|şu|için|ile|olarak|daha|değil|çok|nasıl|neden|hangi|her|ancak|veya|kadar|gibi|sonra|önce|arasında|içinde|üzerinde)\b/u,
    /\b(?:rehberi|fiyatları|fiyatlari|formunu|filomuz|şoförlü|soförlü|kiralama|havalimanından|havalimanindan|günübirlik|guzergâh|guzergah|rezervasyon|karşılama|karsilama|belirlenir|çalışır|calisir|ücretleri|ucretleri)\b/u,
  ];
  return markers.some((marker) => marker.test(text));
}

async function correct(row) {
  const existingUrls = links(row.body || '');
  const mustAddAirportLink = row.source_slug === AIRPORT_SOURCE_SLUG;
  const expectedUrls = mustAddAirportLink
    ? [...existingUrls, AIRPORT_URL]
    : existingUrls;

  const system = `You are an expert native ${row.lang} editor repairing an already translated Istanbul VIP Transfer blog post.
Return only JSON with exactly these string fields: title, excerpt, body, metaTitle, metaDescription, imageAlt.

Rules:
1. Every displayed word, sentence, paragraph, and Markdown link label must be natural ${row.lang}; do not leave Turkish prose or Turkish link labels.
   Do not output Turkish function words or Turkish grammatical expressions such as "ve", "bir", "için", "ile", "olarak", "fiyatları", "rehberi", "araç filomuz", or "rezervasyon formunu" anywhere in displayed copy.
   Use turkishSourceForMeaningOnly to translate every remaining Turkish phrase, but do not copy Turkish source wording into the result.
2. Preserve proper names, airport codes, vehicle models and brand names when appropriate: Sabiha Gökçen, Taksim, Sultanahmet, Istanbul/İstanbul, Vito, Sprinter, Mercedes, VIP, IST, SAW, Türkiye/Turkiye.
3. Preserve every Markdown URL exactly. Do not delete, replace, or add internal URLs. Preserve headings, lists, tables and image Markdown.
4. Do not fabricate facts or prices.
${mustAddAirportLink
  ? `5. Insert exactly one natural ${row.lang} sentence containing this exact official URL as a Markdown link: ${AIRPORT_URL}. Its anchor text must be in ${row.lang}. The body must contain no other http(s) URL.`
  : '5. Do not add external URLs.'}
6. All six returned fields must be non-empty.`;

  const input = {
    targetLanguage: row.lang,
    turkishSourceForMeaningOnly: {
      title: row.source_title,
      excerpt: row.source_excerpt,
      body: row.source_body,
      metaTitle: row.source_meta_title,
      metaDescription: row.source_meta_description,
      imageAlt: row.source_image_alt,
    },
    current: {
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      imageAlt: row.image_alt,
    },
  };

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(input) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 8192,
      });
      const result = JSON.parse(response.choices?.[0]?.message?.content || '{}');
      const empty = requiredFields.filter((field) => typeof result[field] !== 'string' || !result[field].trim());
      if (empty.length > 0) throw new Error(`Empty returned fields: ${empty.join(', ')}`);

      const returnedUrls = links(result.body);
      if (asKey(returnedUrls) !== asKey(expectedUrls)) {
        throw new Error('Markdown URL set changed during correction');
      }
      if (mustAddAirportLink) {
        const externalUrls = returnedUrls.filter((url) => /^https?:\/\//i.test(url));
        if (externalUrls.length !== 1 || externalUrls[0] !== AIRPORT_URL) {
          throw new Error('Airport guide must have exactly one official external URL');
        }
      }

      const allText = requiredFields.map((field) => result[field]).join('\n');
      if (containsTurkishGrammar(allText)) {
        throw new Error('Deterministic Turkish grammar gate rejected corrected output');
      }

      return { ok: true, data: result };
    } catch (error) {
      if (attempt === 4) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      await sleep(1_000 * attempt);
    }
  }
}

try {
  const audit = JSON.parse(await readFile('/tmp/blog-translation-language-audit.json', 'utf8'));
  const flaggedIds = audit.results
    .filter((result) => result.hasUntranslatedTurkish)
    .map((result) => result.id);

  const airportRows = await sql`
    SELECT ct.id
    FROM content_translations ct
    JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.entity_type = 'content'
      AND c.content_type = 'BLOG_POST'
      AND c.slug = ${AIRPORT_SOURCE_SLUG}
      AND ct.target_language_code IN ('en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl')
  `;

  const candidateIds = [...new Set([...flaggedIds, ...airportRows.map((row) => row.id)])];
  if (candidateIds.length === 0) throw new Error('No published translation candidates found');

  const rows = await sql`
    SELECT ct.id, ct.status, ct.target_language_code AS lang, c.slug AS source_slug,
           ct.title, ct.excerpt, ct.body, ct.meta_title, ct.meta_description, ct.image_alt,
           c.title AS source_title, c.excerpt AS source_excerpt, c.body AS source_body,
           c.seo_title AS source_meta_title, c.seo_description AS source_meta_description,
           c.hero_image_alt AS source_image_alt
    FROM content_translations ct
    JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.id = ANY(${candidateIds})
    ORDER BY ct.target_language_code, c.slug
  `;

  if (rows.length !== candidateIds.length) {
    throw new Error(`Candidate retrieval mismatch: expected ${candidateIds.length}, received ${rows.length}`);
  }

  const pendingRows = rows.filter((row) => row.status !== 'PUBLISHED');
  if (pendingRows.length === 0) {
    console.log(JSON.stringify({
      model,
      originalAuditCandidates: flaggedIds.length,
      airportLinkCandidates: airportRows.length,
      processed: 0,
      republished: 0,
      leftDraft: 0,
      message: 'All candidate rows already passed a previous correction run.',
    }, null, 2));
    process.exit(0);
  }

  await sql`
    UPDATE content_translations
    SET status = 'DRAFT',
        failure_reason = 'Yayın öncesi dil kalite düzeltmesi bekleniyor',
        updated_at = NOW()
    WHERE id = ANY(${pendingRows.map((row) => row.id)})
  `;

  const queue = [...pendingRows];
  const results = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      const correction = await correct(row);

      if (correction.ok) {
        await sql`
          UPDATE content_translations
          SET title = ${correction.data.title},
              excerpt = ${correction.data.excerpt},
              body = ${correction.data.body},
              meta_title = ${correction.data.metaTitle},
              meta_description = ${correction.data.metaDescription},
              image_alt = ${correction.data.imageAlt},
              status = 'PUBLISHED',
              published_at = NOW(),
              failure_reason = NULL,
              updated_at = NOW()
          WHERE id = ${row.id}
        `;
        results.push({ id: row.id, lang: row.lang, sourceSlug: row.source_slug, status: 'republished' });
      } else {
        await sql`
          UPDATE content_translations
          SET status = 'DRAFT',
              failure_reason = ${`Dil kalite düzeltmesi başarısız: ${correction.error}`.slice(0, 1000)},
              updated_at = NOW()
          WHERE id = ${row.id}
        `;
        results.push({ id: row.id, lang: row.lang, sourceSlug: row.source_slug, status: 'draft', error: correction.error });
      }
      process.stdout.write(`${results.length}/${pendingRows.length} ${row.lang}/${row.source_slug} ${results.at(-1).status}\n`);
    }
  });
  await Promise.all(workers);

  const report = {
    model,
    originalAuditCandidates: flaggedIds.length,
    airportLinkCandidates: airportRows.length,
    processed: pendingRows.length,
    republished: results.filter((result) => result.status === 'republished').length,
    leftDraft: results.filter((result) => result.status === 'draft').length,
    results: results.sort((a, b) => `${a.lang}/${a.sourceSlug}`.localeCompare(`${b.lang}/${b.sourceSlug}`)),
  };
  await writeFile('/tmp/blog-translation-repair-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}