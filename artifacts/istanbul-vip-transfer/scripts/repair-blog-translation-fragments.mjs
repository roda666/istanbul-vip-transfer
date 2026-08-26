/**
 * Safely repairs only language-audit evidence strings. Keeping all untouched
 * markup guarantees that localized URLs, image references and article layout
 * cannot be changed by a language correction.
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
const airportSentence = {
  en: 'For current flight status and terminal information, please see [Istanbul Airport’s official flight and terminal information](https://www.istairport.com/).',
  de: 'Aktuelle Fluginformationen und Terminalhinweise finden Sie in den [offiziellen Flug- und Terminalinformationen des Istanbul Airport](https://www.istairport.com/).',
  ru: 'Актуальный статус рейсов и информацию о терминалах смотрите в [официальном разделе Istanbul Airport](https://www.istairport.com/).',
  ar: 'للاطلاع على حالة الرحلات ومعلومات مباني الركاب الحالية، راجع [معلومات الرحلات ومباني الركاب الرسمية لمطار إسطنبول](https://www.istairport.com/).',
  es: 'Para consultar el estado actual de los vuelos y la información de terminales, visite la [información oficial de vuelos y terminales del Aeropuerto de Estambul](https://www.istairport.com/).',
  fr: 'Pour connaître l’état des vols et les informations sur les terminaux, consultez les [informations officielles de l’aéroport d’Istanbul](https://www.istairport.com/).',
  it: 'Per lo stato aggiornato dei voli e le informazioni sui terminal, consulta le [informazioni ufficiali su voli e terminal dell’Aeroporto di Istanbul](https://www.istairport.com/).',
  nl: 'Voor de actuele vluchtstatus en terminalinformatie kunt u de [officiële vlucht- en terminalinformatie van Istanbul Airport](https://www.istairport.com/) raadplegen.',
};
const fields = ['title', 'excerpt', 'body', 'meta_title', 'meta_description', 'image_alt'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const markdownLinks = (value) => [...value.matchAll(/\[[^\]]*]\(([^)\s]+)[^)]*\)/g)].map((match) => match[1]);
const key = (items) => [...items].sort().join('\n');

function visibleText(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasTurkishGrammar(value) {
  const text = visibleText(value).toLocaleLowerCase('tr-TR');
  const strongTurkish = /\b(?:için|olarak|daha|değil|çok|nasıl|neden|hangi|ancak|veya|kadar|gibi|sonra|önce|arasında|içinde|üzerinde|rehberi|fiyatları|fiyatlari|formunu|filomuz|şoförlü|soförlü|kiralama|havalimanından|havalimanindan|günübirlik|rezervasyon|karşılama|karsilama|belirlenir|çalışır|calisir|ücretleri|ucretleri)\b/u;
  if (strongTurkish.test(text)) return true;

  // Single short words collide with valid copy in other languages (notably
  // German "her"). Treat them as evidence only when they occur together.
  const weakMatches = text.match(/\b(?:ve|bir|bu|şu|ile)\b/gu) ?? [];
  return weakMatches.length >= 2;
}

function replaceOnceEverywhere(source, replacements) {
  let result = source ?? '';
  for (const replacement of replacements) {
    if (replacement.from === replacement.to) continue;
    result = result.split(replacement.from).join(replacement.to);
  }
  return result;
}

async function translateFragments(row, findings) {
  const candidates = findings
    .map((finding) => finding.exactText)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
  if (candidates.length === 0) return { ok: false, error: 'No audit evidence to repair' };

  const system = `You are a native ${row.lang} copy editor. Translate only the listed Turkish prose fragments into natural ${row.lang}. Return JSON only:
{"replacements":[{"from":"exact original fragment","to":"replacement"}]}

Rules:
- Every "from" must be copied exactly from the supplied candidate list.
- Translate Turkish sentences and Markdown anchor labels. Keep a location/model name unchanged only when it is solely a proper name.
- If a candidate includes Markdown, keep every URL inside it exactly unchanged.
- Never add, remove, reorder, or combine links.
- Do not write commentary.`;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ candidates }) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000,
      });
      const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
      const replacements = Array.isArray(parsed.replacements) ? parsed.replacements : [];
      if (replacements.length === 0) throw new Error('No replacements returned');
      if (replacements.some((item) => !candidates.includes(item.from) || typeof item.to !== 'string')) {
        throw new Error('Replacement list contains an invalid source fragment');
      }
      return { ok: true, replacements };
    } catch (error) {
      if (attempt === 4) return { ok: false, error: error instanceof Error ? error.message : String(error) };
      await sleep(1_000 * attempt);
    }
  }
}

try {
  const audit = JSON.parse(await readFile('/tmp/blog-translation-language-audit.json', 'utf8'));
  const findingsById = new Map(
    audit.results
      .filter((result) => result.hasUntranslatedTurkish)
      .map((result) => [result.id, result.findings ?? []]),
  );
  const candidateIds = [...findingsById.keys()];

  const rows = await sql`
    SELECT ct.id, ct.target_language_code AS lang, c.slug AS source_slug,
           ct.title, ct.excerpt, ct.body, ct.meta_title, ct.meta_description, ct.image_alt
    FROM content_translations ct
    JOIN content c ON c.id::text = ct.entity_id
    WHERE ct.status = 'DRAFT'
      AND (
        ct.id = ANY(${candidateIds})
        OR c.slug = ${AIRPORT_SOURCE_SLUG}
      )
    ORDER BY ct.target_language_code, c.slug
  `;

  const queue = [...rows];
  const results = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      const originalBody = row.body ?? '';
      const originalUrls = markdownLinks(originalBody);
      const evidence = findingsById.get(row.id) ?? [];
      const translated = evidence.length > 0
        ? await translateFragments(row, evidence)
        : { ok: row.source_slug === AIRPORT_SOURCE_SLUG, replacements: [] };

      if (!translated.ok) {
        results.push({ lang: row.lang, sourceSlug: row.source_slug, status: 'draft', error: translated.error });
        continue;
      }

      const next = {};
      for (const field of fields) {
        next[field] = replaceOnceEverywhere(row[field], translated.replacements);
      }
      if (row.source_slug === AIRPORT_SOURCE_SLUG && !next.body.includes(AIRPORT_URL)) {
        next.body = `${next.body.trim()}\n\n${airportSentence[row.lang]}`;
      }

      const expectedUrls = row.source_slug === AIRPORT_SOURCE_SLUG
        ? [...originalUrls, AIRPORT_URL]
        : originalUrls;
      const actualUrls = markdownLinks(next.body);
      const allText = Object.values(next).join('\n');
      const valid = Object.values(next).every((value) => typeof value === 'string' && value.trim())
        && key(actualUrls) === key(expectedUrls)
        && !hasTurkishGrammar(allText);

      if (!valid) {
        await sql`
          UPDATE content_translations
          SET failure_reason = 'Parça düzeltmesi yayın öncesi kalite kapısını geçemedi',
              updated_at = NOW()
          WHERE id = ${row.id}
        `;
        results.push({ lang: row.lang, sourceSlug: row.source_slug, status: 'draft', error: 'Quality gate rejected correction' });
      } else {
        await sql`
          UPDATE content_translations
          SET title = ${next.title},
              excerpt = ${next.excerpt},
              body = ${next.body},
              meta_title = ${next.meta_title},
              meta_description = ${next.meta_description},
              image_alt = ${next.image_alt},
              status = 'PUBLISHED',
              published_at = NOW(),
              failure_reason = NULL,
              updated_at = NOW()
          WHERE id = ${row.id}
        `;
        results.push({ lang: row.lang, sourceSlug: row.source_slug, status: 'republished' });
      }
      process.stdout.write(`${results.length}/${rows.length} ${row.lang}/${row.source_slug} ${results.at(-1).status}\n`);
    }
  });
  await Promise.all(workers);

  const report = {
    model,
    processed: rows.length,
    republished: results.filter((result) => result.status === 'republished').length,
    leftDraft: results.filter((result) => result.status === 'draft').length,
    results,
  };
  await writeFile('/tmp/blog-translation-fragment-repair-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}