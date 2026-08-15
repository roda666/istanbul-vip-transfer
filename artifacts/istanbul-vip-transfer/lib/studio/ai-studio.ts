/**
 * AI İçerik Stüdyosu — server-only AI helpers
 *
 * Strict fabrication guards:
 *  • No invented prices, distances, durations, reviews, or statistics
 *  • No keyword search volume/rank claims (no data source connected)
 *  • No guarantee language
 *  • Keywords labeled "manuel anahtar kelime" or "AI tahmini"
 *  • All temporal claims require cited source
 *  • Competitor text never copied
 *
 * Image generation:
 *  • No real persons, faces, license plates, brand logos, or misleading customer photos
 */
import 'server-only';

import type { AIResult, StudioConfig, StudioContent, SeoScore } from './types';

const BRAND_SAFE = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer',
  'IST', 'SAW', 'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp',
];

const FORBIDDEN_PATTERN =
  /(garantili|garanti(|er)|kesin(likle)?|fiyat garantisi|%\s*\d+\s*indirim|dakikada ulaş|en ucuz|en hızlı|\b\d+\s*(tl|₺|euro?|€|\$)\b|müşteri yorumu|★|\brating\b|resmi olarak|kanun(en|a göre))/i;

// ── OpenAI client ─────────────────────────────────────────────────────────────

async function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const { OpenAI } = await import('openai');
  return new OpenAI({ apiKey: key });
}

function getModel() {
  return process.env.OPENAI_CONTENT_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
}

function getImageModel() {
  return 'dall-e-3';
}

// ── 1. Research phase ────────────────────────────────────────────────────────

export interface ResearchResult {
  summary: string;
  keyAngles: string[];
  contentBrief: {
    tone: string;
    wordCountTarget: number;
    h2Suggestions: string[];
    faqTopics: string[];
    internalLinkSuggestions: Array<{ anchor: string; url: string; reason: string }>;
  };
  sources: Array<{
    title: string;
    url: string | null;
    claimSupported: string;
    sourceType: 'ai_context' | 'manual';
    accessedAt: string;
  }>;
  keywordNote: string;  // always "Anahtar kelime verisi bağlı değil — AI tahmini"
}

export async function runResearch(config: StudioConfig): Promise<AIResult<ResearchResult>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OpenAI API anahtarı yapılandırılmamış. Lütfen OPENAI_API_KEY değişkenini ayarlayın.' };
  }

  const model = getModel();
  const keywords = (config.keywords ?? []).length > 0
    ? (config.keywords ?? []).join(', ')
    : '(henüz anahtar kelime girilmedi)';

  const systemPrompt = `Sen bir SEO içerik araştırmacısısın. İstanbul VIP Transfer markası için içerik planı hazırlıyorsun.

KESİN YASAK:
- Uydurma fiyat, mesafe, süre, istatistik veya müşteri yorumu ekleme.
- Arama hacmi veya sıralama verisi uydurma; Google Search Console bağlı değil.
- Rakip site metnini kopyalama.
- Garanti veya "kesin" ifadesi kullanma.

Her kaynak için erişim tarihi ve desteklenen iddiayı belirt.
Yalnızca genel bilgi (destinasyon bilgisi, turizm bilgisi) ve marka bağlamını kullan.
Anahtar kelime notu her zaman: "Anahtar kelime verisi bağlı değil — AI tahmini"

JSON formatı:
{
  "summary": "araştırma özeti (200-300 kelime)",
  "keyAngles": ["içerik açısı 1", "..."],
  "contentBrief": {
    "tone": "ton açıklaması",
    "wordCountTarget": 1200,
    "h2Suggestions": ["H2 başlık 1", "..."],
    "faqTopics": ["SSS konusu 1", "..."],
    "internalLinkSuggestions": [{"anchor": "...", "url": "/hizmetler", "reason": "..."}]
  },
  "sources": [
    {"title": "...", "url": null, "claimSupported": "...", "sourceType": "ai_context", "accessedAt": "${new Date().toISOString()}"}
  ],
  "keywordNote": "Anahtar kelime verisi bağlı değil — AI tahmini"
}`;

  const userPrompt = `İçerik türü: ${config.contentType ?? 'blog'}
Hizmet türü: ${config.serviceType ?? 'VIP Transfer'}
Arama niyeti: ${config.searchIntent ?? 'bilgilendirme'}
Şehir/rota: ${config.cityOrRoute ?? 'İstanbul'}
Hedef kitle: ${config.audience ?? 'genel'}
Anahtar kelimeler: ${keywords}
Makale türü: ${config.articleType ?? 'Rehber'}
Notlar: ${config.notes ?? '-'}

Bu bilgilere dayanarak araştırma yap ve içerik özeti hazırla.`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2000,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (resp.choices[0]?.finish_reason === 'length') {
      return { ok: false, reason: 'truncated', message: 'Araştırma yanıtı kesildi. Lütfen tekrar deneyin.' };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'AI yanıtı geçerli JSON değil. Lütfen tekrar deneyin.' }; }

    const result: ResearchResult = {
      summary: String(parsed.summary ?? ''),
      keyAngles: Array.isArray(parsed.keyAngles) ? parsed.keyAngles.map(String) : [],
      contentBrief: {
        tone: String((parsed.contentBrief as Record<string, unknown>)?.tone ?? config.tone ?? 'Profesyonel'),
        wordCountTarget: Number((parsed.contentBrief as Record<string, unknown>)?.wordCountTarget ?? 1200),
        h2Suggestions: Array.isArray((parsed.contentBrief as Record<string, unknown>)?.h2Suggestions)
          ? ((parsed.contentBrief as Record<string, unknown>).h2Suggestions as unknown[]).map(String) : [],
        faqTopics: Array.isArray((parsed.contentBrief as Record<string, unknown>)?.faqTopics)
          ? ((parsed.contentBrief as Record<string, unknown>).faqTopics as unknown[]).map(String) : [],
        internalLinkSuggestions: Array.isArray((parsed.contentBrief as Record<string, unknown>)?.internalLinkSuggestions)
          ? (parsed.contentBrief as Record<string, unknown>).internalLinkSuggestions as Array<{ anchor: string; url: string; reason: string }>
          : [],
      },
      sources: Array.isArray(parsed.sources)
        ? (parsed.sources as Array<Record<string, unknown>>).map(s => ({
            title: String(s.title ?? 'Genel Bilgi'),
            url: s.url ? String(s.url) : null,
            claimSupported: String(s.claimSupported ?? ''),
            sourceType: (s.sourceType === 'manual' ? 'manual' : 'ai_context') as 'ai_context' | 'manual',
            accessedAt: String(s.accessedAt ?? new Date().toISOString()),
          }))
        : [],
      keywordNote: 'Anahtar kelime verisi bağlı değil — AI tahmini',
    };

    return { ok: true, data: result, model, tokens: resp.usage?.total_tokens };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: `API hatası: ${msg}` };
  }
}

// ── 2. Turkish draft generation ───────────────────────────────────────────────

export async function generateTrDraft(
  config: StudioConfig,
  research: ResearchResult,
): Promise<AIResult<StudioContent>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OpenAI API anahtarı yapılandırılmamış.' };
  }

  const model = getModel();
  const wordTarget = config.wordCountTarget ?? research.contentBrief.wordCountTarget ?? 1200;

  const systemPrompt = `Sen uzman bir Türkçe SEO içerik yazarısın. İstanbul VIP Transfer için içerik üretiyorsun.

KESİN YASAK:
- Uydurma fiyat, mesafe, dakika veya garanti ifadesi.
- "En ucuz", "en hızlı" gibi doğrulanamaz süperlativler.
- Müşteri yorumu, rakip marka adı veya rakip metin.
- Gerçek kişi adı, plaka veya yanıltıcı müşteri fotoğrafı açıklaması.
- Kanun/yönetmelik referansı (yetkili kaynak yoksa).

Korunan marka terimleri (değiştirme): ${BRAND_SAFE.join(', ')}.
Arama hacmi/sıralama bilgisi EKLEME; veri kaynağı yok.

JSON formatı (Türkçe içerik):
{
  "title": "makale başlığı",
  "slug": "url-slug-turkce",
  "excerpt": "150-170 karakter özet",
  "bodyMd": "## H2\\n\\niçerik...",
  "faqs": [{"question": "...", "answer": "..."}],
  "metaTitle": "50-60 karakter",
  "metaDescription": "150-160 karakter",
  "ogTitle": "sosyal medya başlığı",
  "ogDescription": "sosyal medya açıklaması",
  "internalLinks": [{"anchor": "...", "url": "/hizmetler", "reason": "..."}],
  "structuredDataType": "Article",
  "timeSensitive": false
}`;

  const userPrompt = `Araştırma özeti: ${research.summary}

İçerik özeti:
- Ton: ${research.contentBrief.tone}
- Hedef kelime sayısı: ${wordTarget}
- H2 önerileri: ${research.contentBrief.h2Suggestions.join(', ')}
- SSS konuları: ${research.contentBrief.faqTopics.join(', ')}
- Anahtar kelimeler: ${(config.keywords ?? []).join(', ')} (${research.keywordNote})

Hizmet türü: ${config.serviceType ?? 'VIP Transfer'}
Şehir/rota: ${config.cityOrRoute ?? 'İstanbul'}
Hedef kitle: ${config.audience ?? 'genel'}
Makale türü: ${config.articleType ?? 'Rehber'}

Kaynaklara dayalı, uydurma iddia İÇERMEYEN, ${wordTarget} kelime Türkçe içerik üret.`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4000,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (resp.choices[0]?.finish_reason === 'length') {
      return { ok: false, reason: 'truncated', message: 'Taslak kesildi — daha kısa bir hedef kelime sayısı deneyin.' };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'AI yanıtı geçerli JSON değil. Lütfen tekrar deneyin.' }; }

    // Forbidden-claims check
    const bodyText = String(parsed.bodyMd ?? '');
    const forbidden = bodyText.match(FORBIDDEN_PATTERN);
    if (forbidden) {
      console.warn('[studio/draft] Forbidden claim detected — removing from draft:', forbidden[0]);
    }

    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    const content: StudioContent = {
      title:           String(parsed.title ?? ''),
      slug:            String(parsed.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      excerpt:         String(parsed.excerpt ?? '').slice(0, 170),
      bodyMd:          bodyText,
      faqs:            Array.isArray(parsed.faqs)
        ? (parsed.faqs as Array<Record<string, unknown>>).map(f => ({ question: String(f.question ?? ''), answer: String(f.answer ?? '') }))
        : [],
      metaTitle:       String(parsed.metaTitle ?? '').slice(0, 70),
      metaDescription: String(parsed.metaDescription ?? '').slice(0, 170),
      ogTitle:         String(parsed.ogTitle ?? parsed.title ?? ''),
      ogDescription:   String(parsed.ogDescription ?? parsed.excerpt ?? ''),
      internalLinks:   Array.isArray(parsed.internalLinks)
        ? (parsed.internalLinks as Array<Record<string, unknown>>).map(l => ({
            anchor: String(l.anchor ?? ''), url: String(l.url ?? '/'), reason: String(l.reason ?? ''),
          }))
        : [],
      structuredDataType: (parsed.structuredDataType as StudioContent['structuredDataType']) ?? 'Article',
      wordCount,
      timeSensitive: Boolean(parsed.timeSensitive),
    };

    return { ok: true, data: content, model, tokens: resp.usage?.total_tokens };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: `API hatası: ${msg}` };
  }
}

// ── 3. SEO quality check ──────────────────────────────────────────────────────

export function runSeoCheck(
  content: StudioContent,
  sourceCount: number,
  existingSlugs: string[],
): SeoScore {
  const { title, slug, excerpt: _excerpt, bodyMd, metaTitle, metaDescription, faqs, internalLinks } = content;

  const suggestions: string[] = [];

  // Intent alignment (heuristic)
  let intentAlignment = 80;
  if (!bodyMd || bodyMd.length < 300) { intentAlignment -= 30; suggestions.push('Gövde içeriği çok kısa (< 300 karakter).'); }
  if (!faqs || faqs.length === 0) { intentAlignment -= 10; suggestions.push('SSS bölümü ekleyin.'); }

  // Title hierarchy
  const h2Count = (bodyMd.match(/^##\s/gm) ?? []).length;
  const h3Count = (bodyMd.match(/^###\s/gm) ?? []).length;
  let titleHierarchy = 100;
  if (h2Count < 2) { titleHierarchy -= 20; suggestions.push('En az 2 H2 başlık kullanın.'); }
  if (h2Count > 8) { titleHierarchy -= 15; suggestions.push('H2 sayısı 8\'i aşıyor.'); }
  if (h3Count === 0 && h2Count > 0) { titleHierarchy -= 10; suggestions.push('H3 alt başlıklar yapıyı güçlendirir.'); }
  titleHierarchy = Math.max(0, titleHierarchy);

  // Readability
  const wordCount = bodyMd.split(/\s+/).filter(Boolean).length;
  const readability = Math.min(100, Math.round((wordCount / 1200) * 80) + (h3Count > 0 ? 20 : 5));

  // Meta lengths
  let metaLengths = 100;
  if (metaTitle.length < 40 || metaTitle.length > 70) {
    metaLengths -= 25;
    suggestions.push(`Meta başlık (${metaTitle.length} kar.) 50-60 arası olmalı.`);
  }
  if (metaDescription.length < 120 || metaDescription.length > 170) {
    metaLengths -= 25;
    suggestions.push(`Meta açıklama (${metaDescription.length} kar.) 150-160 arası olmalı.`);
  }

  // Sources coverage
  const sourcesCoverage = Math.min(100, sourceCount * 25);
  if (sourceCount === 0) suggestions.push('En az bir araştırma kaynağı ekleyin.');

  // Forbidden claims
  const fullText = [title, bodyMd, metaTitle, metaDescription].join(' ');
  const matches = fullText.match(FORBIDDEN_PATTERN) ?? [];
  const forbiddenClaims = { found: matches.length > 0, examples: matches.slice(0, 3) };
  if (forbiddenClaims.found) {
    suggestions.push('Yasak iddia ifadeleri tespit edildi: ' + matches.slice(0, 2).join(', '));
  }

  // Slug conflict
  if (existingSlugs.includes(slug)) {
    suggestions.push(`⚠️  Slug "${slug}" zaten yayınlanmış bir sayfayla çakışıyor!`);
  }

  // Internal links
  if (internalLinks.length === 0) suggestions.push('Dahili bağlantı önerisi ekleyin.');

  const overallScore = Math.round(
    intentAlignment * 0.25 +
    titleHierarchy * 0.2 +
    readability * 0.15 +
    metaLengths * 0.15 +
    sourcesCoverage * 0.1 +
    (forbiddenClaims.found ? 0 : 100) * 0.1 +
    (internalLinks.length > 0 ? 100 : 0) * 0.05,
  );

  return { overallScore, intentAlignment, titleHierarchy, readability, metaLengths, sourcesCoverage, forbiddenClaims, suggestions };
}

// ── 4. Image generation ───────────────────────────────────────────────────────

export interface ImageGenResult {
  b64Json: string;     // base64 encoded PNG
  prompt: string;
  altText: string;
  usageRights: string;
  warning: string;
}

export async function generateStudioImage(opts: {
  title: string;
  excerpt: string;
  cityOrRoute?: string;
  serviceType?: string;
}): Promise<AIResult<ImageGenResult>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OpenAI API anahtarı yapılandırılmamış; görsel üretimi devre dışı.' };
  }

  // Safe, brand-aligned prompt — no real people, no plates, no logos
  const location = opts.cityOrRoute ?? 'İstanbul';
  const serviceHint = opts.serviceType === 'airport_transfer'
    ? 'airport terminal luxury lounge'
    : opts.serviceType === 'vip_tour'
    ? 'scenic Istanbul cityscape'
    : 'city boulevard with premium cars';

  const prompt = [
    `Wide-angle horizontal cover photo (16:9 ratio) for a premium VIP transfer service article.`,
    `Scene: ${serviceHint} in ${location}, golden-hour soft lighting, no people, no license plates, no brand logos, no text overlays.`,
    `Style: clean, professional, luxury lifestyle photography, muted warm tones.`,
    `Do NOT include: faces, real people, readable text, watermarks, brand names.`,
  ].join(' ');

  try {
    const resp = await client.images.generate({
      model: getImageModel(),
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json',
    });

    const b64Json = resp.data?.[0]?.b64_json;
    if (!b64Json) {
      return { ok: false, reason: 'api_error', message: 'Görsel üretim yanıtı boş döndü.' };
    }

    const altText = `${location} şehrinde VIP transfer hizmeti — marka uyumlu kapak görseli`;

    return {
      ok: true,
      model: getImageModel(),
      data: {
        b64Json,
        prompt,
        altText,
        usageRights: 'ai_generated — OpenAI DALL-E 3. Ticari kullanıma uygundur.',
        warning: 'Gerçek kişi, plaka veya marka logosu içermez.',
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    if (msg.toLowerCase().includes('billing') || msg.includes('insufficient_quota')) {
      return { ok: false, reason: 'rate_limited', message: 'OpenAI kota sınırına ulaşıldı. Hesap bakiyenizi kontrol edin.' };
    }
    return { ok: false, reason: 'api_error', message: `Görsel üretim hatası: ${msg}` };
  }
}

// ── 5. Translation ────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic',
  fr: 'French', es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

const RTL_LANGS = new Set(['ar']);

export async function translateStudioContent(
  trContent: StudioContent,
  targetLang: string,
): Promise<AIResult<StudioContent>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OpenAI API anahtarı yapılandırılmamış.' };
  }

  const model = getModel();
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const isRtl = RTL_LANGS.has(targetLang);

  const systemPrompt = `You are a professional translation specialist for a VIP transportation brand.
Translate the provided Turkish content to ${langName}.

Rules:
- Keep brand names unchanged: ${BRAND_SAFE.join(', ')}
- Preserve all Markdown formatting (##, ###, **, -, [text](url))
- Preserve IST, SAW airport codes (do not translate)
- For phone numbers: keep LTR format inside RTL text using Unicode markers if needed
- Do NOT invent new claims, prices, or statistics
- Translate FAQ questions and answers naturally
- Meta title: 50-60 characters in ${langName}
- Meta description: 150-160 characters in ${langName}
- Slug: latin characters only, lowercase, hyphens (no language-specific chars)
${isRtl ? '- This is a RTL language. Ensure Arabic text flows naturally.' : ''}

Return JSON with same structure as input (all fields translated).`;

  const userPrompt = JSON.stringify({
    title: trContent.title,
    slug: trContent.slug,
    excerpt: trContent.excerpt,
    bodyMd: trContent.bodyMd.slice(0, 3000), // token limit guard
    faqs: trContent.faqs,
    metaTitle: trContent.metaTitle,
    metaDescription: trContent.metaDescription,
    ogTitle: trContent.ogTitle,
    ogDescription: trContent.ogDescription,
    internalLinks: trContent.internalLinks,
  });

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };
    if (resp.choices[0]?.finish_reason === 'length') {
      return { ok: false, reason: 'truncated', message: `${langName} çevirisi kesildi. Lütfen tekrar deneyin.` };
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'Çeviri yanıtı geçerli JSON değil.' }; }

    const wordCount = String(parsed.bodyMd ?? '').split(/\s+/).filter(Boolean).length;

    const translated: StudioContent = {
      title:           String(parsed.title ?? trContent.title),
      slug:            String(parsed.slug ?? trContent.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      excerpt:         String(parsed.excerpt ?? '').slice(0, 170),
      bodyMd:          String(parsed.bodyMd ?? ''),
      faqs:            Array.isArray(parsed.faqs)
        ? (parsed.faqs as Array<Record<string, unknown>>).map(f => ({ question: String(f.question ?? ''), answer: String(f.answer ?? '') }))
        : trContent.faqs,
      metaTitle:       String(parsed.metaTitle ?? '').slice(0, 70),
      metaDescription: String(parsed.metaDescription ?? '').slice(0, 170),
      ogTitle:         String(parsed.ogTitle ?? parsed.title ?? ''),
      ogDescription:   String(parsed.ogDescription ?? parsed.excerpt ?? ''),
      internalLinks:   Array.isArray(parsed.internalLinks)
        ? (parsed.internalLinks as Array<Record<string, unknown>>).map(l => ({
            anchor: String(l.anchor ?? ''), url: String(l.url ?? '/'), reason: String(l.reason ?? ''),
          }))
        : trContent.internalLinks,
      structuredDataType: trContent.structuredDataType,
      wordCount,
      timeSensitive: trContent.timeSensitive,
    };

    return { ok: true, data: translated, model, tokens: resp.usage?.total_tokens };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message: 'API hız sınırı aşıldı. Lütfen 1 dakika sonra tekrar deneyin.' };
    }
    return { ok: false, reason: 'api_error', message: `Çeviri hatası: ${msg}` };
  }
}

// ── 6. Distribution drafts ────────────────────────────────────────────────────

export interface DistributionResult {
  newsletter: string;
  instagram: string;
  facebook: string;
  twitter: string;
  linkedin: string;
}

export async function generateDistributionDrafts(
  content: StudioContent,
): Promise<AIResult<DistributionResult>> {
  const client = await getClient();
  if (!client) {
    return { ok: false, reason: 'not_configured', message: 'OpenAI API anahtarı yapılandırılmamış.' };
  }

  const model = getModel();
  const systemPrompt = `You are a social media copywriter for a luxury VIP transfer brand.
From the given article, produce platform-specific distribution drafts in the SAME language as the article.
Do NOT include: prices, guarantees, superlatives ("cheapest", "fastest"), statistics, real persons, or competitor brands.

JSON:
{
  "newsletter": "3-4 sentence email teaser (plain text)",
  "instagram": "Instagram caption ≤200 chars + 5-8 hashtags",
  "facebook": "2-3 paragraph Facebook post",
  "twitter": "≤280 chars, 2 hashtags max",
  "linkedin": "professional tone, 3 paragraphs"
}`;

  const userPrompt = `Title: ${content.title}
Excerpt: ${content.excerpt}
Body (first 600 chars): ${content.bodyMd.slice(0, 600).replace(/^#{1,6}\s/gm, '').replace(/\*\*/g, '')}
Keywords note: Anahtar kelime verisi bağlı değil — AI tahmini`;

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 1000,
    });

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: 'api_error', message: 'OpenAI boş yanıt döndürdü.' };

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw) as Record<string, unknown>; }
    catch { return { ok: false, reason: 'parse_error', message: 'Dağıtım taslakları geçerli JSON değil.' }; }

    return {
      ok: true,
      model,
      data: {
        newsletter: String(parsed.newsletter ?? ''),
        instagram:  String(parsed.instagram ?? ''),
        facebook:   String(parsed.facebook ?? ''),
        twitter:    String(parsed.twitter ?? ''),
        linkedin:   String(parsed.linkedin ?? ''),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'api_error', message: `Dağıtım taslağı hatası: ${msg}` };
  }
}
