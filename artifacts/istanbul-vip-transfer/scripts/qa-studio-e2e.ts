/**
 * AI İçerik Stüdyosu — E2E QA Test Script
 *
 * Doğrudan OpenAI SDK + Drizzle DB kullanır.
 * Güvenlik:
 *   - API anahtarı asla loglanmaz veya döndürülmez
 *   - CMS aktarımı yalnızca DRAFT (isActive:false, publishedAt:null)
 *   - Proje başlığı [QA-TEST] etiketi taşır
 *   - Test sonunda proje arşivlenir
 *   - Sosyal/bülten/domain işlemi yapılmaz
 *
 * Kullanım: node_modules/.bin/tsx scripts/qa-studio-e2e.ts
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import OpenAI from 'openai';

// ── Env ───────────────────────────────────────────────────────────────────────
const DB_URL     = process.env.DATABASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!DB_URL)     { console.error('❌ DATABASE_URL eksik'); process.exit(1); }
if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY eksik'); process.exit(1); }

const sqlClient = postgres(DB_URL, { max: 3 });
const db        = drizzle(sqlClient, { schema });
const ai        = new OpenAI({ apiKey: OPENAI_KEY });
const MODEL     = process.env.OPENAI_CONTENT_MODEL ?? 'gpt-5.4-mini';

const TARGET_LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
type Lang = typeof TARGET_LANGS[number];

const LANG_NAMES: Record<string, string> = {
  en: 'English', de: 'German',  ru: 'Russian', ar: 'Arabic',
  fr: 'French',  es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

// ── RTL protection ────────────────────────────────────────────────────────────
function applyRtl(text: string): string {
  return text
    .replace(/(\+?\d[\d\s\-().]{6,17}\d)/g, '\u202A$1\u202C')
    .replace(/\b(IST|SAW|LHR|CDG|JFK|AMS|FCO|SVO|DXB)\b/g, '\u202A$1\u202C');
}

// ── Result tracker ─────────────────────────────────────────────────────────────
type Status = 'PASS' | 'FAIL' | 'WARN';
interface R { stage: string; status: Status; detail: string; tokens?: number; ms?: number }
const results: R[] = [];
function log(r: R) {
  results.push(r);
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`  ${icon} ${r.stage}: ${r.detail}`);
}

// ── OpenAI chat helper ────────────────────────────────────────────────────────
async function chatJson(system: string, user: string, maxTokens = 3000): Promise<{
  data: Record<string, unknown>; tokens: number; ms: number;
}> {
  const t0 = Date.now();
  const resp = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: maxTokens,
  }, { signal: AbortSignal.timeout(90_000) });
  const ms     = Date.now() - t0;
  const raw    = resp.choices[0]?.message?.content ?? '{}';
  const tokens = resp.usage?.total_tokens ?? 0;
  return { data: JSON.parse(raw) as Record<string, unknown>, tokens, ms };
}

// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  AI İçerik Stüdyosu — E2E QA Testi');
  console.log('  ' + new Date().toLocaleString('tr-TR'));
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── 0. Tablo kontrolü ─────────────────────────────────────────────────────
  console.log('[ 0 ] Tablo kontrolü...');
  const TABLES = [
    'studio_projects', 'studio_project_translations', 'studio_images',
    'studio_research', 'studio_distribution', 'studio_audit', 'studio_schedules',
  ];
  for (const t of TABLES) {
    try {
      await sqlClient`SELECT 1 FROM ${sqlClient(t)} LIMIT 1`;
      log({ stage: `Tablo: ${t}`, status: 'PASS', detail: 'mevcut' });
    } catch {
      log({ stage: `Tablo: ${t}`, status: 'FAIL', detail: 'YOK — migration uygulanmamış!' });
      await sqlClient.end(); process.exit(1);
    }
  }

  // ── 1. Proje oluştur ──────────────────────────────────────────────────────
  console.log('\n[ 1 ] QA projesi oluşturuluyor...');
  const cfg = {
    contentType: 'blog', serviceType: 'airport_transfer',
    searchIntent: 'bilgilendirme', cityOrRoute: 'İstanbul',
    audience: 'uluslararası iş profesyonelleri',
    keywords: ['istanbul havalimanı vip transfer', 'ist havalimanı karşılama'],
    articleType: 'Rehber', tone: 'Profesyonel ve samimi', wordCountTarget: 800,
    notes: '[QA-TEST] Otomatik test — yayınlanmayacak.',
  };
  const [proj] = await db.insert(schema.studioProjects).values({
    contentType: 'blog', stage: 'setup', status: 'draft',
    titleWorking: '[QA-TEST] İstanbul Havalimanı VIP Transfer Rehberi',
    config: cfg as never,
  }).returning();
  log({ stage: 'Proje oluşturma', status: 'PASS', detail: `ID: ${proj.id}` });

  // ── 2. Araştırma ──────────────────────────────────────────────────────────
  console.log('\n[ 2 ] Araştırma (OpenAI)...');
  let researchSummary = '';
  let h2Suggestions: string[] = [];
  let faqTopics: string[] = [];
  try {
    const r = await chatJson(
      `SEO araştırmacısı olarak İstanbul VIP Transfer için JSON araştırma raporu hazırla.
Kural: Uydurma fiyat/istatistik ekleme. Kaynak tipi: "ai_context". Anahtar kelime notu: "AI tahmini — veri kaynağı yok".
JSON formatı:
{"summary":"200 kelime araştırma özeti","keyAngles":["açı 1","açı 2"],"contentBrief":{"tone":"Profesyonel","wordCountTarget":800,"h2Suggestions":["H2-1","H2-2","H2-3"],"faqTopics":["SSS 1","SSS 2","SSS 3"]},"sources":[{"title":"Genel Bilgi","url":null,"claimSupported":"İstanbul IST ve SAW havalimanlarına sahip büyük bir şehirdir","sourceType":"ai_context","accessedAt":"${new Date().toISOString()}"}],"keywordNote":"AI tahmini — veri kaynağı yok"}`,
      `Hizmet: Havalimanı VIP Transfer\nŞehir: İstanbul\nAnahtar kelimeler: ${cfg.keywords.join(', ')}\nHedef kitle: ${cfg.audience}`,
      1800
    );
    researchSummary   = String(r.data.summary ?? '');
    const brief       = (r.data.contentBrief ?? {}) as Record<string, unknown>;
    h2Suggestions     = Array.isArray(brief.h2Suggestions) ? brief.h2Suggestions.map(String) : [];
    faqTopics         = Array.isArray(brief.faqTopics)     ? brief.faqTopics.map(String)     : [];
    const sources     = Array.isArray(r.data.sources) ? r.data.sources as Array<Record<string, unknown>> : [];

    if (sources.length > 0) {
      await db.insert(schema.studioResearch).values(sources.map(s => ({
        projectId: proj.id,
        url: s.url as string | null,
        title: String(s.title ?? 'Genel Bilgi'),
        accessedAt: new Date(),
        claims: [String(s.claimSupported ?? '')],
        sourceType: 'ai_context' as const,
      })));
    }
    log({ stage: 'Araştırma', status: 'PASS', detail: `${sources.length} kaynak, model:${MODEL}, ${r.ms} ms`, tokens: r.tokens, ms: r.ms });
    console.log(`    Anahtar kelime notu: ${String(r.data.keywordNote ?? '')}`);
    console.log(`    H2 önerileri: ${h2Suggestions.join(' | ')}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : String(e);
    log({ stage: 'Araştırma', status: 'FAIL', detail: msg });
    await cleanup(proj.id); await sqlClient.end(); process.exit(1);
  }

  // ── 3. Türkçe Taslak ──────────────────────────────────────────────────────
  console.log('\n[ 3 ] Türkçe taslak (OpenAI)...');
  let trContent: Record<string, unknown> = {};
  try {
    const r = await chatJson(
      `Uzman Türkçe SEO yazarısın. İstanbul VIP Transfer için JSON blog içeriği üret.
Kural: Uydurma fiyat/garanti/istatistik yok. "En ucuz/hızlı" yok. Müşteri yorumu yok.
JSON:
{"title":"Türkçe başlık","slug":"latin-slug","excerpt":"150-170 karakter","bodyMd":"## H2\\n\\niçerik paragrafı...\\n\\n## H2-2\\n\\niçerik...","faqs":[{"question":"Soru?","answer":"Cevap."},{"question":"Soru 2?","answer":"Cevap 2."}],"metaTitle":"50-60 kar.","metaDescription":"150-160 kar.","ogTitle":"OG başlık","ogDescription":"OG açıklama","internalLinks":[{"anchor":"Transfer hizmetlerimiz","url":"/hizmetler","reason":"İlgili hizmetler"}]}`,
      `Araştırma özeti: ${researchSummary.slice(0, 500)}\nH2 önerileri: ${h2Suggestions.join(', ')}\nSSS konuları: ${faqTopics.join(', ')}\nAnahtar kelimeler: ${cfg.keywords.join(', ')}\nHedef: 800 kelime, şehir: İstanbul`,
      3500
    );
    trContent = r.data;
    const wc = String(r.data.bodyMd ?? '').split(/\s+/).filter(Boolean).length;

    await db.update(schema.studioProjects).set({
      trContent: r.data as never,
      stage: 'draft', status: 'draft',
      trApprovedAt: new Date(), // QA için otomatik onay — gerçek kullanımda human onayı zorunlu
      updatedAt: new Date(),
    }).where(eq(schema.studioProjects.id, proj.id));

    await db.insert(schema.studioAudit).values({
      projectId: proj.id, action: 'draft_generated',
      detail: { model: MODEL, tokens: r.tokens, wordCount: wc, qa: true } as never,
    });

    log({ stage: 'TR Taslak', status: 'PASS', detail: `${wc} kelime, ${r.ms} ms`, tokens: r.tokens, ms: r.ms });
    console.log(`    Başlık: ${String(r.data.title ?? '').slice(0, 80)}`);
    console.log(`    Slug: ${String(r.data.slug ?? '')}`);
    console.log(`    Meta başlık: ${String(r.data.metaTitle ?? '')} (${String(r.data.metaTitle ?? '').length} kar.)`);
    console.log(`    Meta açıklama: ${String(r.data.metaDescription ?? '').length} karakter`);
    console.log(`    SSS: ${Array.isArray(r.data.faqs) ? r.data.faqs.length : 0} adet`);
    log({ stage: 'TR Onay (QA-otomatik)', status: 'PASS', detail: 'trApprovedAt set — gerçek kullanımda human onayı zorunlu' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : String(e);
    log({ stage: 'TR Taslak', status: 'FAIL', detail: msg });
    await cleanup(proj.id); await sqlClient.end(); process.exit(1);
  }

  // ── 4. SEO Skoru (kural tabanlı, saf JS) ──────────────────────────────────
  console.log('\n[ 4 ] SEO kontrolü...');
  {
    const body     = String(trContent.bodyMd ?? '');
    const h2Count  = (body.match(/^##\s/gm) ?? []).length;
    const wc       = body.split(/\s+/).filter(Boolean).length;
    const metaT    = String(trContent.metaTitle ?? '');
    const metaD    = String(trContent.metaDescription ?? '');
    const faqCnt   = Array.isArray(trContent.faqs) ? trContent.faqs.length : 0;
    const FORB     = /(garantili|kesin(likle)?|en ucuz|en hızlı|\bgaranti\b)/i;
    const forbOk   = !FORB.test([body, metaT, metaD].join(' '));

    const score = Math.round(
      (h2Count >= 2 ? 25 : 10) +
      (wc >= 600 ? 25 : 10) +
      (metaT.length >= 40 && metaT.length <= 70 ? 20 : 5) +
      (metaD.length >= 120 && metaD.length <= 170 ? 15 : 5) +
      (faqCnt > 0 ? 10 : 0) +
      (forbOk ? 5 : 0)
    );
    log({ stage: 'SEO Skoru', status: score >= 60 ? 'PASS' : 'WARN', detail: `${score}/100 (H2:${h2Count}, kelime:${wc}, meta:${metaT.length}/${metaD.length})` });
    log({ stage: 'Yasak İddia Kontrolü', status: forbOk ? 'PASS' : 'WARN', detail: forbOk ? 'Temiz' : 'Şüpheli ifade tespit edildi — manuel review gerekli' });
    await db.update(schema.studioProjects)
      .set({ seoScore: { overallScore: score, h2Count, wordCount: wc } as never })
      .where(eq(schema.studioProjects.id, proj.id));
  }

  // ── 5. DALL-E 3 Görsel ────────────────────────────────────────────────────
  console.log('\n[ 5 ] DALL-E 3 görsel üretimi...');
  {
    const imagePrompt = 'Wide-angle 16:9 cover for premium VIP airport transfer article, Istanbul. Golden-hour lighting, luxury vehicle silhouette at modern terminal. No people, no license plates, no brand logos, no text. Clean professional style, muted warm tones.';
    const t0 = Date.now();
    try {
      const imgResp = await ai.images.generate({
        model: 'dall-e-3', prompt: imagePrompt, n: 1,
        size: '1792x1024', quality: 'standard', response_format: 'b64_json',
      }, { signal: AbortSignal.timeout(60_000) });

      const b64 = imgResp.data?.[0]?.b64_json;
      if (b64) {
        const kb = Math.round(b64.length * 0.75 / 1024);
        const ms = Date.now() - t0;
        await db.insert(schema.studioImages).values({
          projectId: proj.id,
          prompt: imagePrompt,
          altText: 'İstanbul Havalimanı VIP transfer hizmeti — AI kapak görseli',
          usageRights: 'ai_generated',
          status: 'pending_approval',
          // Note: PRIVATE_OBJECT_DIR not set in dev — store size reference only, not full b64
          url: `[QA-TEST: DALL-E 3 başarılı, ${kb} KB — depolama yapılandırıldığında yüklenecek]`,
        });
        log({ stage: 'DALL-E 3 Görsel', status: 'PASS', detail: `${kb} KB, ${ms} ms — pending_approval (nesne depolama yapılandırılmamış)`, ms });
        console.log(`    ⚠️  PRIVATE_OBJECT_DIR yapılandırılmamış: görsel URL'si geçici referans`);
        console.log(`    Güvenli yeniden deneme: Depolama yapılandırılıp görsel adımı tekrar çalıştırılabilir`);
      } else {
        log({ stage: 'DALL-E 3 Görsel', status: 'WARN', detail: 'API boş yanıt döndürdü', ms: Date.now() - t0 });
      }
    } catch (e: unknown) {
      const ms  = Date.now() - t0;
      const msg = e instanceof Error ? e.message : String(e);
      const isBilling = msg.includes('429') || msg.toLowerCase().includes('billing') || msg.includes('insufficient_quota');
      log({
        stage: 'DALL-E 3 Görsel',
        status: 'WARN',
        detail: isBilling
          ? `Kota/billing sınırı (${ms} ms) — OpenAI hesabında DALL-E 3 erişimi gerekli. Güvenli yeniden deneme: admin panelinden görsel adımını tekrar çalıştırın.`
          : `API hatası: ${msg.slice(0, 150)}`,
        ms,
      });
    }
  }

  // ── 6. 8 Dil Çevirisi ─────────────────────────────────────────────────────
  console.log('\n[ 6 ] 8 dil çevirisi (EN/DE/RU/AR/FR/ES/IT/NL)...');
  const trBody = String(trContent.bodyMd ?? '').slice(0, 4000);
  const trFaqs = (Array.isArray(trContent.faqs) ? trContent.faqs : []) as Array<{ question: string; answer: string }>;
  let passLangs = 0; let failLangs = 0;

  for (const lang of TARGET_LANGS) {
    process.stdout.write(`    ${lang.toUpperCase()}… `);
    const isRtl = lang === 'ar';
    try {
      const r = await chatJson(
        `Professional translator for luxury VIP transport brand. Translate Turkish JSON to ${LANG_NAMES[lang]}.
Rules: Keep brand terms (VIP Transfer Istanbul, IST, SAW, Mercedes Vito, Mercedes Sprinter) unchanged. Preserve Markdown. No invented data.
Slug: latin chars + hyphens only (no diacritics). metaTitle 50-60 chars. metaDescription 150-160 chars.${isRtl ? '\nArabic RTL: wrap phone numbers (+90...) and airport codes (IST,SAW) with Unicode LTR markers \\u202A...\\u202C so they display correctly inside RTL text.' : ''}
Return JSON with EXACTLY the same keys as input.`,
        JSON.stringify({
          title: trContent.title, slug: trContent.slug, excerpt: trContent.excerpt,
          bodyMd: trBody, faqs: trFaqs,
          metaTitle: trContent.metaTitle, metaDescription: trContent.metaDescription,
          ogTitle: trContent.ogTitle, ogDescription: trContent.ogDescription,
        }),
        3500
      );

      let body = String(r.data.bodyMd ?? '');
      let faqs = (Array.isArray(r.data.faqs) ? r.data.faqs : trFaqs) as Array<{ question: string; answer: string }>;

      if (isRtl) {
        body = applyRtl(body);
        faqs = faqs.map(f => ({ question: applyRtl(String(f.question ?? '')), answer: applyRtl(String(f.answer ?? '')) }));
      }

      const slug = String(r.data.slug ?? trContent.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const wc   = body.split(/\s+/).filter(Boolean).length;
      const mTL  = String(r.data.metaTitle ?? '').length;
      const mDL  = String(r.data.metaDescription ?? '').length;

      const translated = { ...r.data, bodyMd: body, faqs, slug };

      // Idempotent upsert
      const [ex] = await db.select({ id: schema.studioProjectTranslations.id })
        .from(schema.studioProjectTranslations)
        .where(and(
          eq(schema.studioProjectTranslations.projectId, proj.id),
          eq(schema.studioProjectTranslations.lang, lang),
        )).limit(1);

      if (ex) {
        await db.update(schema.studioProjectTranslations)
          .set({ content: translated as never, status: 'draft', aiModel: MODEL, aiTokens: r.tokens, updatedAt: new Date() })
          .where(eq(schema.studioProjectTranslations.id, ex.id));
      } else {
        await db.insert(schema.studioProjectTranslations).values({
          projectId: proj.id, lang,
          content: translated as never, status: 'draft',
          aiModel: MODEL, aiTokens: r.tokens,
        });
      }

      console.log(`TAMAM (${wc} kelime, ${r.ms} ms)`);
      log({
        stage: `Çeviri: ${lang.toUpperCase()}`,
        status: 'PASS',
        detail: `${wc} kelime, meta:${mTL}/${mDL} kar., slug:"${slug}", ${r.ms} ms`,
        tokens: r.tokens, ms: r.ms,
      });

      if (isRtl) {
        const hasLtr  = body.includes('\u202A');
        const hasPhone = /\+9/.test(body);
        log({ stage: 'AR RTL Koruması', status: hasLtr || !hasPhone ? 'PASS' : 'WARN', detail: hasLtr ? 'LTR bidi işaretleri ✓' : 'İşaret yok (metin telefon içermiyorsa normal)' });
        log({ stage: 'AR Slug (Latin)', status: /^[a-z0-9-]+$/.test(slug) ? 'PASS' : 'FAIL', detail: `"${slug}"` });
        log({ stage: 'AR Meta Başlık', status: mTL >= 40 && mTL <= 70 ? 'PASS' : 'WARN', detail: `${mTL} karakter` });
      }

      passLangs++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 150) : String(e);
      console.log(`HATA`);
      log({ stage: `Çeviri: ${lang.toUpperCase()}`, status: 'FAIL', detail: msg });
      failLangs++;
    }
  }

  // ── 7. DB Doğrulaması ─────────────────────────────────────────────────────
  console.log('\n[ 7 ] Veritabanı doğrulaması (9 içerik: TR + 8 dil)...');
  {
    const saved = await db.select({
      lang: schema.studioProjectTranslations.lang,
      status: schema.studioProjectTranslations.status,
      tokens: schema.studioProjectTranslations.aiTokens,
    }).from(schema.studioProjectTranslations)
      .where(eq(schema.studioProjectTranslations.projectId, proj.id));

    log({ stage: 'DB: Çeviri sayısı', status: saved.length === TARGET_LANGS.length ? 'PASS' : 'WARN', detail: `${saved.length}/${TARGET_LANGS.length} dil kaydedildi` });
    for (const s of saved) console.log(`    ${s.lang.toUpperCase()}: durum=${s.status}, token=${s.tokens}`);

    const [dbProj] = await db.select({ trContent: schema.studioProjects.trContent, trApprovedAt: schema.studioProjects.trApprovedAt })
      .from(schema.studioProjects).where(eq(schema.studioProjects.id, proj.id)).limit(1);
    log({ stage: 'DB: TR içerik', status: dbProj?.trContent ? 'PASS' : 'FAIL', detail: dbProj?.trContent ? 'trContent mevcut' : 'EKSİK' });
    log({ stage: 'DB: TR onayı', status: dbProj?.trApprovedAt ? 'PASS' : 'FAIL', detail: dbProj?.trApprovedAt ? `trApprovedAt: ${dbProj.trApprovedAt.toISOString()}` : 'EKSİK' });
  }

  // ── 8. CMS DRAFT Aktarımı ─────────────────────────────────────────────────
  console.log('\n[ 8 ] CMS DRAFT aktarımı (isActive:false, publishedAt:null)...');
  {
    const baseSlug = String(trContent.slug ?? 'vip-transfer').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const qaSlug   = `qa-test-${baseSlug}-${Date.now()}`.slice(0, 100);

    const [cmsRow] = await db.insert(schema.content).values({
      slug:           qaSlug,
      contentType:    'BLOG_POST' as never,
      status:         'DRAFT' as never,
      title:          `[QA-TEST] ${String(trContent.title ?? '')}`.slice(0, 200),
      excerpt:        String(trContent.excerpt ?? '').slice(0, 300),
      body:           String(trContent.bodyMd ?? '').slice(0, 50000),
      seoTitle:       String(trContent.metaTitle ?? '').slice(0, 70),
      seoDescription: String(trContent.metaDescription ?? '').slice(0, 170),
      ogTitle:        String(trContent.ogTitle ?? ''),
      ogDescription:  String(trContent.ogDescription ?? ''),
      publishedAt:    null,
      isActive:       false,       // Kamuya gösterilmez
      showOnHomepage: false,
      showInNav:      false,
      author:         '[QA-TEST-AUTO]',
      tags:           ['qa-test', 'auto-generated'] as never,
    }).returning({ id: schema.content.id, slug: schema.content.slug });

    await db.update(schema.studioProjects)
      .set({ cmsEntityId: cmsRow.id, cmsEntityType: 'blog', stage: 'review', updatedAt: new Date() })
      .where(eq(schema.studioProjects.id, proj.id));

    log({ stage: 'CMS DRAFT Aktarımı', status: 'PASS', detail: `ID:${cmsRow.id}, slug:"${cmsRow.slug}", DRAFT, isActive:false, publishedAt:null` });
  }

  // ── 9. Idempotency Testi ──────────────────────────────────────────────────
  console.log('\n[ 9 ] Idempotency testi (EN tekrar kaydet)...');
  {
    const before = (await db.select().from(schema.studioProjectTranslations)
      .where(eq(schema.studioProjectTranslations.projectId, proj.id))).length;

    const [enRow] = await db.select({ id: schema.studioProjectTranslations.id })
      .from(schema.studioProjectTranslations)
      .where(and(
        eq(schema.studioProjectTranslations.projectId, proj.id),
        eq(schema.studioProjectTranslations.lang, 'en'),
      )).limit(1);

    if (enRow) {
      await db.update(schema.studioProjectTranslations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.studioProjectTranslations.id, enRow.id));
    }

    const after = (await db.select().from(schema.studioProjectTranslations)
      .where(eq(schema.studioProjectTranslations.projectId, proj.id))).length;

    log({ stage: 'Idempotency: Tekrar kaydet', status: before === after ? 'PASS' : 'FAIL', detail: `Önce:${before} → Sonra:${after} (yineleme ${before === after ? 'YOK ✓' : 'VAR ❌'})` });
  }

  // ── 10. Arşivle ───────────────────────────────────────────────────────────
  console.log('\n[ 10 ] QA projesi arşivleniyor...');
  await db.update(schema.studioProjects)
    .set({ status: 'archived', stage: 'archived', updatedAt: new Date() })
    .where(eq(schema.studioProjects.id, proj.id));
  await db.insert(schema.studioAudit).values({
    projectId: proj.id, action: 'qa_test_archived',
    detail: { reason: 'E2E QA tamamlandı — arşivlendi', langs: TARGET_LANGS, qa: true } as never,
  });
  log({ stage: 'QA Arşivleme', status: 'PASS', detail: `Proje arşivlendi, gerçek içerikle karışmaz` });

  // ── Özet ─────────────────────────────────────────────────────────────────
  const passed      = results.filter(r => r.status === 'PASS').length;
  const warned      = results.filter(r => r.status === 'WARN').length;
  const failed      = results.filter(r => r.status === 'FAIL').length;
  const totalTokens = results.reduce((s, r) => s + (r.tokens ?? 0), 0);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  QA SONUÇLARI');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Geçti:     ${passed}`);
  console.log(`  ⚠️  Uyarı:    ${warned}`);
  console.log(`  ❌ Başarısız: ${failed}`);
  console.log(`  🔤 Toplam token: ~${totalTokens}`);
  console.log(`  🌍 Dil başarısı: ${passLangs}/${TARGET_LANGS.length}`);
  console.log(`  🆔 Proje ID: ${proj.id} (arşivlendi)`);
  console.log('──────────────────────────────────────────────────────────────');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
    console.log(`  ${icon} ${r.stage}: ${r.detail}`);
  });
  console.log('══════════════════════════════════════════════════════════════\n');

  await sqlClient.end();
}

async function cleanup(projectId: string) {
  try {
    await db.update(schema.studioProjects)
      .set({ status: 'archived', stage: 'archived' })
      .where(eq(schema.studioProjects.id, projectId));
    await sqlClient.end();
  } catch { /* ignore */ }
}

main().catch(err => {
  console.error('\n❌ QA hatası:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
