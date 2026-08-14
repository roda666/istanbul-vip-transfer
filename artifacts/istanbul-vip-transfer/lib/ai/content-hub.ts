/**
 * AI Content Hub — server-only OpenAI helpers.
 *
 * Covers:
 *  1. suggestTopicAndKeywords() — returns a keyword cluster without fabricating metrics
 *  2. generateArticleDraft()   — produces a full blog draft; records research sources
 *  3. generateSocialDrafts()   — newsletter summary + Twitter/LinkedIn/Instagram
 *
 * STRICT fabrication guards:
 *  - No invented prices, distances, durations, regulations, or reviews
 *  - No keyword volume/rank claims (provider not connected)
 *  - No "guarantees" language of any kind
 *  - All temporal claims prohibited unless from a cited source
 */
import 'server-only';

const BRAND_PRESERVE = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp',
];

const FORBIDDEN_CLAIMS_PATTERN =
  /(garantili|garanti(|er)|kesin(likle)?|fiyat garantisi|%\s*\d+\s*indirim|dakikada ulaş|en ucuz|en hızlı|\d+\s*tl|\d+\s*euro|\d+\s*\$|müşteri yorumu|★|\brating\b|bbb onaylı|resmi olarak|yasal olarak|kanun(en|a göre)|yönetmelik)/i;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopicSuggestion {
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  searchIntent: string;
  contentSummary: string;
  suggestedH2s: string[];
  dataSourceNote: string;           // always "Anahtar kelime verisi bağlı değil"
  estimatedWordCount: number;
}

export interface ArticleDraft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;                     // Markdown: ## H2, ### H3, - lists, **bold**, [text](url)
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  suggestedCta: { text: string; url: string };
  suggestedFaqs: Array<{ question: string; answer: string }>;
  researchSources: Array<{
    title: string; url: string; claimSupported: string; sourceType: string;
  }>;
  timeSensitive: boolean;
  forbiddenClaimsFound: string[];
  wordCount: number;
}

export interface SocialDrafts {
  newsletterSummary: string;
  twitterDraft: string;
  linkedinDraft: string;
  instagramCaption: string;
}

export type AIResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'api_error' | 'parse_error' | 'truncated'; message: string; partial?: string };

// ── Shared OpenAI client factory ───────────────────────────────────────────────

async function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import('openai');
  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.OPENAI_CONTENT_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
}

// ── 1. Topic + keyword suggestion ─────────────────────────────────────────────

const LANG_INSTRUCTION: Record<string, string> = {
  tr: 'Tüm çıktı Türkçe olmalı.',
  en: 'All output must be in English.',
  de: 'Alle Ausgaben müssen auf Deutsch sein.',
  ru: 'Все выходные данные должны быть на русском языке.',
  ar: 'يجب أن تكون جميع المخرجات باللغة العربية.',
  fr: 'Toutes les sorties doivent être en français.',
  es: 'Toda la salida debe estar en español.',
  it: 'Tutto l\'output deve essere in italiano.',
  nl: 'Alle uitvoer moet in het Nederlands zijn.',
};

function langInstruction(lang = 'tr'): string {
  return LANG_INSTRUCTION[lang] ?? `All output must be in the "${lang}" language.`;
}

export async function suggestTopicAndKeywords(opts: {
  articleType: string;
  targetService: string;
  targetLocation: string;
  customerProfile?: string;
  targetCountry?: string;
  searchIntent?: string;
  tone?: string;
  wordCountTarget?: number;
  targetLanguage?: string;
}): Promise<AIResult<TopicSuggestion>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OPENAI_API_KEY yapılandırılmamış.' };
  }

  const lang  = opts.targetLanguage ?? 'tr';
  const model = getModel();
  const systemPrompt = `You are a content strategist and SEO expert for Istanbul VIP Transfer.
Generate a topic and keyword cluster for a blog article based on the given parameters.
${langInstruction(lang)}

STRICT RULES:
1. Do NOT fabricate keyword search volume, ranking estimates, or competition scores — no real data source is connected.
2. Do NOT produce "guaranteed ranking", "traffic guarantee", price claims, or regulatory assertions.
3. Output format: valid JSON object — nothing else.
4. Preserve brand/vehicle names as-is: ${BRAND_PRESERVE.join(', ')}.

Use this JSON schema:
{
  "title": "string — article title (H1 level)",
  "primaryKeyword": "string — main focus keyword",
  "supportingKeywords": ["string", ...],
  "searchIntent": "Informational|Commercial|Navigational|Transactional",
  "contentSummary": "string — 2-3 sentence content summary",
  "suggestedH2s": ["string", ...],
  "estimatedWordCount": number
}`;

  const userPrompt = `Article type: ${opts.articleType}
Target service: ${opts.targetService}
Target location: ${opts.targetLocation}
Customer profile: ${opts.customerProfile ?? 'Not specified'}
Target country: ${opts.targetCountry ?? 'Not specified'}
Search intent: ${opts.searchIntent ?? 'Not specified'}
Tone: ${opts.tone ?? 'Professional, trustworthy'}
Target word count: ${opts.wordCountTarget ?? 1500}
Output language: ${lang}

Generate a topic and keyword cluster. JSON output:`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1000,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (resp.choices[0]?.finish_reason === 'length') {
      return { ok: false, reason: 'truncated', message: 'Yanıt kesildi (max_tokens)', partial: raw };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'AI yanıtı geçerli JSON değil.', partial: raw }; }

    const suggestion: TopicSuggestion = {
      title:              String(parsed.title ?? ''),
      primaryKeyword:     String(parsed.primaryKeyword ?? ''),
      supportingKeywords: Array.isArray(parsed.supportingKeywords) ? (parsed.supportingKeywords as unknown[]).map(String) : [],
      searchIntent:       String(parsed.searchIntent ?? ''),
      contentSummary:     String(parsed.contentSummary ?? ''),
      suggestedH2s:       Array.isArray(parsed.suggestedH2s) ? (parsed.suggestedH2s as unknown[]).map(String) : [],
      estimatedWordCount: typeof parsed.estimatedWordCount === 'number' ? parsed.estimatedWordCount : 1500,
      dataSourceNote:     'Anahtar kelime verisi bağlı değil — hacim ve sıralama tahminleri gösterilemiyor.',
    };
    return { ok: true, data: suggestion, model };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: msg };
  }
}

// ── 2. Article draft generation ────────────────────────────────────────────────

export async function generateArticleDraft(opts: {
  title: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  searchIntent: string;
  suggestedH2s: string[];
  targetService: string;
  targetLocation: string;
  customerProfile?: string;
  targetCountry?: string;
  wordCountTarget?: number;
  tone?: string;
  competitorContext?: string;
  targetLanguage?: string;
}): Promise<AIResult<ArticleDraft>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OPENAI_API_KEY yapılandırılmamış.' };
  }

  const lang  = opts.targetLanguage ?? 'tr';
  const model = getModel();
  const systemPrompt = `You are a content writer for Istanbul VIP Transfer.
Generate a full blog article draft in the target language based on the given topic and keyword data.
${langInstruction(lang)}

ABSOLUTE PROHIBITIONS — strictly forbidden:
1. Specific prices, distances (km), durations (minutes/hours), or capacity figures.
2. Claims like "guaranteed", "cheapest", "official", "legally required", "by law".
3. Customer reviews, star ratings (★), "5 stars on Google"-type statements.
4. Competitor names or comparisons.
5. Time-sensitive figures like "2026 prices", "current rates", "today's exchange rate".
6. Search volume, CTR, or conversion rate predictions.

PERMITTED:
- General service advantages (comfort, private vehicle, professional driver).
- General geographic or cultural facts about Istanbul (IST, SAW airport names are fine).
- Brand/vehicle names: ${BRAND_PRESERVE.join(', ')}.

MARKDOWN OUTPUT FORMAT — do NOT use HTML tags:
- H2 headings: ## Heading Text
- H3 headings: ### Heading Text
- Bullet lists: - item text
- Numbered lists: 1. item text
- Bold: **bold text**
- Links (placeholder): [anchor text](#rezervasyon)
- Paragraphs: plain text lines separated by blank lines

JSON SCHEMA:
{
  "title": "string — SEO title (H1 level)",
  "slug": "string — url-safe slug in target language, lowercase, hyphens only",
  "excerpt": "string — 150-160 character summary",
  "body": "string — full Markdown content using ## H2 / ### H3 / - lists / **bold** / blank lines between paragraphs",
  "metaTitle": "string — 50-60 character SEO title",
  "metaDescription": "string — 150-160 character SEO description",
  "ogTitle": "string — social share title",
  "ogDescription": "string — social share description",
  "suggestedCta": { "text": "string", "url": "#rezervasyon" },
  "suggestedFaqs": [{ "question": "string", "answer": "string" }],
  "researchSources": [{ "title": "string", "url": "string", "claimSupported": "string", "sourceType": "ai_context" }],
  "timeSensitive": boolean,
  "forbiddenClaimsFound": ["string"]
}`;

  const userPrompt = `Article title: ${opts.title}
Primary keyword: ${opts.primaryKeyword}
Supporting keywords: ${opts.supportingKeywords.join(', ')}
Search intent: ${opts.searchIntent}
Suggested H2s: ${opts.suggestedH2s.join(', ')}
Target service: ${opts.targetService}
Target location: ${opts.targetLocation}
Customer profile: ${opts.customerProfile ?? 'Not specified'}
Target country: ${opts.targetCountry ?? 'Turkey and international'}
Tone: ${opts.tone ?? 'Professional, trustworthy, warm'}
Target word count: ~${opts.wordCountTarget ?? 1500}
Output language: ${lang}
${opts.competitorContext ? `Competitor context (for reference only): ${opts.competitorContext}` : ''}

Generate the full article draft. JSON output:`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4000,
    });

    const raw = resp.choices[0]?.message?.content;
    const wasTruncated = resp.choices[0]?.finish_reason === 'length';
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (wasTruncated) {
      return { ok: false, reason: 'truncated', message: 'Makale taslağı kesildi (token limiti). "Yeniden Dene" butonunu kullanın.', partial: raw };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'AI yanıtı geçerli JSON değil.', partial: raw }; }

    const body = String(parsed.body ?? '');
    const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

    // Check for forbidden claims in the generated content
    const fullText = [body, String(parsed.title ?? ''), String(parsed.excerpt ?? '')].join(' ');
    const forbiddenMatches = fullText.match(FORBIDDEN_CLAIMS_PATTERN) ?? [];

    const draft: ArticleDraft = {
      title:          String(parsed.title ?? opts.title),
      slug:           String(parsed.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 180),
      excerpt:        String(parsed.excerpt ?? ''),
      body,
      metaTitle:      String(parsed.metaTitle ?? ''),
      metaDescription: String(parsed.metaDescription ?? ''),
      ogTitle:        String(parsed.ogTitle ?? ''),
      ogDescription:  String(parsed.ogDescription ?? ''),
      suggestedCta:   (parsed.suggestedCta && typeof parsed.suggestedCta === 'object')
        ? (parsed.suggestedCta as { text: string; url: string })
        : { text: 'Hemen Rezervasyon Yap', url: '#rezervasyon' },
      suggestedFaqs:  Array.isArray(parsed.suggestedFaqs)
        ? (parsed.suggestedFaqs as Array<{ question: string; answer: string }>)
        : [],
      researchSources: Array.isArray(parsed.researchSources)
        ? (parsed.researchSources as Array<{ title: string; url: string; claimSupported: string; sourceType: string }>)
        : [],
      timeSensitive:  Boolean(parsed.timeSensitive),
      forbiddenClaimsFound: forbiddenMatches.slice(0, 5),
      wordCount,
    };
    return { ok: true, data: draft, model };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: msg };
  }
}

// ── 3. Social media + newsletter drafts ───────────────────────────────────────

export async function generateSocialDrafts(opts: {
  title: string;
  excerpt: string;
  body: string;
  primaryKeyword: string;
  targetLanguage?: string;
}): Promise<AIResult<SocialDrafts>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OPENAI_API_KEY yapılandırılmamış.' };
  }

  const lang  = opts.targetLanguage ?? 'tr';
  const model = getModel();
  const systemPrompt = `You are a social media copywriter for a VIP transportation brand.
From the given blog article, generate: a newsletter summary, Twitter/X draft, LinkedIn draft, and Instagram caption.
${langInstruction(lang)}
Do NOT include prices, guarantees, rankings, or specific time/distance claims in any of them.
JSON SCHEMA:
{
  "newsletterSummary": "string — 3-4 sentence newsletter summary",
  "twitterDraft": "string — max 280 chars, emoji optional, max 2 #hashtags",
  "linkedinDraft": "string — professional tone, 3-4 paragraphs",
  "instagramCaption": "string — supports visuals, emoji, ideal 150-200 chars, 5-8 hashtags at end"
}`;

  const userPrompt = `Article title: ${opts.title}
Summary: ${opts.excerpt}
Primary keyword: ${opts.primaryKeyword}
Output language: ${lang}
Content (first 800 chars): ${opts.body.slice(0, 800).replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/^-\s/gm, '')}

Generate social media drafts. JSON output:`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 900,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (resp.choices[0]?.finish_reason === 'length') {
      return { ok: false, reason: 'truncated', message: 'Sosyal medya taslakları kesildi.', partial: raw };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'AI yanıtı geçerli JSON değil.', partial: raw }; }

    const drafts: SocialDrafts = {
      newsletterSummary: String(parsed.newsletterSummary ?? ''),
      twitterDraft:      String(parsed.twitterDraft ?? ''),
      linkedinDraft:     String(parsed.linkedinDraft ?? ''),
      instagramCaption:  String(parsed.instagramCaption ?? ''),
    };
    return { ok: true, data: drafts, model };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: msg };
  }
}

// ── 4. Quality score analysis (no AI — pure text analysis) ────────────────────

export interface QualityScore {
  intentAlignment:    number;   // 0-100
  uniqueness:         number;
  titleHierarchy:     number;
  readability:        number;
  metaLengths:        number;
  altTextPresent:     boolean;
  internalLinkCount:  number;
  sourcesCoverage:    number;
  forbiddenClaims:    { found: boolean; examples: string[] };
  overallScore:       number;
  suggestions:        string[];
}

export function analyzeQuality(opts: {
  title: string;
  body: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  sourceCount: number;
  internalLinks?: Array<{ href: string }>;
}): QualityScore {
  const suggestions: string[] = [];
  // Body may be Markdown or HTML — strip both for plain text
  const plain = opts.body.replace(/<[^>]+>/g, ' ').replace(/#{1,6}\s/g, ' ').replace(/\*{1,2}/g, '').replace(/`/g, '');
  // Count H2/H3 in Markdown (## / ###) and HTML (<h2 / <h3)
  const h2Count = (opts.body.match(/^##\s/gm) ?? []).length + (opts.body.match(/<h2/gi) ?? []).length;
  const h3Count = (opts.body.match(/^###\s/gm) ?? []).length + (opts.body.match(/<h3/gi) ?? []).length;
  // Images: Markdown ![alt](url) or HTML <img>
  const mdImgWithAlt  = (opts.body.match(/!\[[^\]]{3,}\]\(/g) ?? []).length;
  const mdImgNoAlt    = (opts.body.match(/!\[\]\(/g) ?? []).length;
  const htmlAltImgs   = (opts.body.match(/alt="[^"]{3,}"/gi) ?? []).length;
  const htmlImgTotal  = (opts.body.match(/<img/gi) ?? []).length;
  const altImgs  = mdImgWithAlt + htmlAltImgs;
  const imgTotal = mdImgWithAlt + mdImgNoAlt + htmlImgTotal;
  const wordCount = plain.split(/\s+/).filter(Boolean).length;
  const internalLinkCount = (opts.internalLinks ?? []).length + (opts.body.match(/<a\s[^>]*href="#[^"]+"/gi) ?? []).length;

  // Intent alignment: keyword present in title + first 100 words
  const first100 = plain.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  const kwInTitle = opts.title.toLowerCase().includes(opts.primaryKeyword.toLowerCase()) ? 1 : 0;
  const kwInIntro = first100.includes(opts.primaryKeyword.toLowerCase()) ? 1 : 0;
  const intentAlignment = Math.min(100, 50 + kwInTitle * 30 + kwInIntro * 20);
  if (kwInTitle === 0) suggestions.push(`"${opts.primaryKeyword}" birincil anahtar kelimesini başlığa ekleyin.`);
  if (kwInIntro === 0) suggestions.push('Birincil anahtar kelimeyi ilk 100 kelimede kullanın.');

  // Title hierarchy
  let titleHierarchy = 100;
  if (h2Count < 3) { titleHierarchy -= 30; suggestions.push('En az 3 H2 başlık ekleyin.'); }
  if (h2Count > 8) { titleHierarchy -= 15; suggestions.push('H2 sayısı 8\'den fazla — odağı kaybedebilir.'); }
  titleHierarchy = Math.max(0, titleHierarchy);

  // Readability: sentence length variety, word count
  const readability = Math.min(100, Math.round((wordCount / 1500) * 70) + (h3Count > 0 ? 30 : 10));

  // Meta lengths
  const mtLen = opts.metaTitle.length;
  const mdLen = opts.metaDescription.length;
  let metaLengths = 100;
  if (mtLen < 40 || mtLen > 70) { metaLengths -= 25; suggestions.push(`Meta başlık uzunluğu (${mtLen} kar.) 50-60 arası olmalı.`); }
  if (mdLen < 120 || mdLen > 170) { metaLengths -= 25; suggestions.push(`Meta açıklama (${mdLen} kar.) 150-160 arası olmalı.`); }

  // ALT text
  const altTextPresent = imgTotal === 0 || altImgs >= Math.ceil(imgTotal * 0.8);
  if (!altTextPresent) suggestions.push('Görsellerin en az %80\'inde ALT metni ekleyin.');

  // Sources coverage
  const sourcesCoverage = Math.min(100, opts.sourceCount * 20);
  if (opts.sourceCount === 0) suggestions.push('En az bir araştırma kaynağı belirtin.');

  // Forbidden claims
  const fullText = [opts.title, opts.body, opts.excerpt].join(' ');
  const fbMatches = fullText.match(/(garantili|garanti(|er)|kesin(likle)?|fiyat garantisi|en ucuz|en hızlı|\d+\s*tl|\d+\s*euro)/gi) ?? [];
  const forbiddenClaims = { found: fbMatches.length > 0, examples: fbMatches.slice(0, 3) };
  if (forbiddenClaims.found) suggestions.push('Yasak iddia ifadeleri tespit edildi: ' + fbMatches.slice(0, 2).join(', '));

  // Uniqueness (heuristic — no plagiarism tool)
  const uniqueness = 70; // baseline, no tool connected

  const overallScore = Math.round(
    (intentAlignment * 0.25 + titleHierarchy * 0.2 + readability * 0.15 +
     metaLengths * 0.15 + sourcesCoverage * 0.1 + uniqueness * 0.1 +
     (forbiddenClaims.found ? 0 : 100) * 0.05) * 1
  );

  return {
    intentAlignment,
    uniqueness,
    titleHierarchy,
    readability,
    metaLengths,
    altTextPresent,
    internalLinkCount,
    sourcesCoverage,
    forbiddenClaims,
    overallScore,
    suggestions,
  };
}
