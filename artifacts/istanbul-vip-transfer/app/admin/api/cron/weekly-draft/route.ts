/**
 * POST /admin/api/cron/weekly-draft
 *
 * Weekly cron handler — creates a new AI Studio draft automatically.
 * Called by Replit Scheduled Deployment (or any external cron) once a week.
 *
 * Auth: requires Authorization header matching CRON_SECRET env var.
 *
 * Logic:
 *  1. If GSC connected → pick top keyword opportunity from real data
 *  2. Else → AI estimation (labeled "AI tahmini — GSC bağlı değil")
 *  3. Create a studio project, run research, generate TR draft
 *  4. Set status = 'draft' — NEVER auto-publishes
 *
 * Idempotency: skips if a draft was already created in the last 5 days
 * (prevents duplicate runs from misconfigured cron).
 */
import { NextRequest, NextResponse } from 'next/server';
import 'server-only';
import {
  DEFAULT_DRAFT_CADENCE,
  getDraftCadenceSlot,
  isCadenceDue,
  isDraftCadencePeriod,
  uniqueTopicOffset,
} from '@/lib/studio/draft-cadence';

export const dynamic = 'force-dynamic';

// Pre-defined fallback topics when GSC is not connected.
// Rotation uses ISO week-of-year so ALL topics are reachable (day-of-week % N
// only covers 0-6, leaving topics beyond index 6 permanently unreachable).
const FALLBACK_TOPICS = [
  // ── Orijinal 7 konu ──────────────────────────────────────────────────────────
  { title: 'İstanbul Havalimanı VIP Karşılama Hizmeti: İlk İzlenim Rehberi', keyword: 'istanbul havalimanı karşılama hizmeti', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'Kurumsal VIP Transfer: Şirket Misafiri Ağırlama Rehberi', keyword: 'kurumsal vip transfer istanbul', intent: 'commercial', service: 'kurumsal transfer' },
  { title: 'İstanbul Düğün Transferi: Gelin Arabası Alternatifleri', keyword: 'istanbul düğün transfer aracı', intent: 'commercial', service: 'özel etkinlik transferi' },
  { title: 'Gece Geç Saatte İstanbul Havalimanı Transferi: Güvenli Seçenekler', keyword: 'gece havalimanı transfer istanbul', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'İstanbul\'dan Ankara\'ya VIP Araç Kiralama Karşılaştırması', keyword: 'istanbul ankara vip araç kiralama', intent: 'commercial', service: 'şehirlerarası transfer' },
  { title: 'Sabiha Gökçen Havalimanı Karşılama Hizmetleri: Kapsamlı Rehber', keyword: 'sabiha gökçen karşılama hizmeti', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'VIP Transfer Rezervasyonu İpuçları: Seyahat Öncesi Bilinmesi Gerekenler', keyword: 'vip transfer rezervasyon ipuçları', intent: 'informational', service: 'vip transfer' },

  // ── Yeni 6 konu — gerçek Google arama davranışından ──────────────────────────
  // Şehirlerarası — yüksek hacim sinyali (İstanbul→Bodrum tatil koridoru)
  { title: 'İstanbul Bodrum VIP Transfer Rehberi: Konforlu Şehirlerarası Yolculuk', keyword: 'istanbul bodrum vip transfer', intent: 'informational', service: 'şehirlerarası transfer' },
  // Batı Marmara koridoru
  { title: 'İstanbul Balıkesir ve Ayvalık Transfer Hizmeti: Ege\'ye Keyifli Yolculuk', keyword: 'istanbul balıkesir ayvalık transfer', intent: 'informational', service: 'şehirlerarası transfer' },
  // Tarihi/turistik tur açısı
  { title: 'Gelibolu Yarımadası Tarihi Turu: VIP Araçla Eksiksiz Ziyaret Rehberi', keyword: 'gelibolu turu vip transfer', intent: 'informational', service: 'özel tur transferi' },
  // Düğün/etkinlik — rakiplerin de güçlü olduğu niş
  { title: 'Gelin Arabası Alternatifleri: Vito ile Özel Düğün Transferi', keyword: 'düğün için vito kiralama istanbul', intent: 'commercial', service: 'özel etkinlik transferi' },
  // Meet & Greet — rakiplerin öne çıkardığı, bizim hizmetimizle örtüşen konsept
  { title: 'Havalimanı VIP Karşılama Hizmeti: İsim Tabelası ile Meet & Greet', keyword: 'havalimanı isim tabelası karşılama hizmeti', intent: 'commercial', service: 'havalimanı transferi' },
  // Rakip karşılaştırma / karar aşaması içeriği
  { title: 'İstanbul VIP Transfer Firması Nasıl Seçilir? Karşılaştırma Rehberi', keyword: 'istanbul vip transfer firması seçimi', intent: 'commercial', service: 'vip transfer' },
];

/**
 * Returns the ISO week-of-year for a given date (1-based).
 * Using week number instead of day-of-week ensures all N topics can be selected
 * in a weekly rotation (day-of-week is always 0-6, unreachable beyond index 6).
 */
function isoWeekOfYear(d: Date = new Date()): number {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
}

function fallbackTopic(topicOffset: number) {
  return FALLBACK_TOPICS[(isoWeekOfYear() + topicOffset) % FALLBACK_TOPICS.length];
}

/**
 * Creates exactly one draft and never publishes it. The cadence runner owns
 * when this can be called and how many unique items a calendar slot produces.
 */
async function createAutomaticDraft(topicOffset = 0) {
  try {
    const { db } = await import('@/db');
    const { studioProjects } = await import('@/db/schema');

    // ── Pick topic ─────────────────────────────────────────────────────────
    let topicTitle: string;
    let primaryKeyword: string;
    let searchIntent: string;
    let targetService: string;
    let dataSourceNote: string;

    // ── Data source priority: GSC → Google Ads Keyword Planner → AI fallback ──

    const { isGscConnected, findKeywordOpportunities } = await import('@/lib/gsc');
    const { isGoogleAdsConnected, findKeywordOpportunitiesFromAds } = await import('@/lib/google-ads');

    const gscOk  = await isGscConnected();
    const gadsOk = gscOk ? false : await isGoogleAdsConnected(); // skip Ads check if GSC works

    if (gscOk) {
      // ── Priority 1: Google Search Console (real traffic data) ─────────────
      const opResult = await findKeywordOpportunities(5);
      if (opResult.ok && opResult.opportunities.length > 0) {
        const top = opResult.opportunities[0];
        primaryKeyword = top.query;
        topicTitle     = `${top.query.charAt(0).toUpperCase() + top.query.slice(1)} — Kapsamlı Rehber`;
        searchIntent   = top.reason === 'low_ctr' ? 'informational' : 'commercial';
        targetService  = 'vip transfer';
        dataSourceNote = `Google Search Console verisi: ${top.impressions.toLocaleString('tr-TR')} gösterim, %${(top.ctr * 100).toFixed(1)} CTR`;
      } else {
        console.warn('[cron/weekly-draft] GSC connected but no opportunity data:', opResult);
        // GSC connected but insufficient data — fall to AI
        const fallback = fallbackTopic(topicOffset);
        topicTitle     = fallback.title;
        primaryKeyword = fallback.keyword;
        searchIntent   = fallback.intent;
        targetService  = fallback.service;
        dataSourceNote = 'AI tahmini — GSC veri yetersiz';
      }
    } else if (gadsOk) {
      // ── Priority 2: Google Ads Keyword Planner (search volume data) ───────
      const adsResult = await findKeywordOpportunitiesFromAds(5);
      if (adsResult.ok && adsResult.opportunities.length > 0) {
        const top = adsResult.opportunities[0];
        primaryKeyword = top.keyword;
        topicTitle     = `${top.keyword.charAt(0).toUpperCase() + top.keyword.slice(1)} — Kapsamlı Rehber`;
        searchIntent   = 'informational';
        targetService  = 'vip transfer';
        dataSourceNote = `Google Ads Keyword Planner: ~${top.monthlySearches.toLocaleString('tr-TR')} aylık arama, rekabet: ${top.competition}`;
      } else {
        console.warn('[cron/weekly-draft] Google Ads connected but no data:', adsResult);
        const fallback = fallbackTopic(topicOffset);
        topicTitle     = fallback.title;
        primaryKeyword = fallback.keyword;
        searchIntent   = fallback.intent;
        targetService  = fallback.service;
        dataSourceNote = 'AI tahmini — Google Ads veri yetersiz';
      }
    } else {
      // ── Priority 3: AI estimation (curated fallback pool) ─────────────────
      const fallback = fallbackTopic(topicOffset);
      topicTitle     = fallback.title;
      primaryKeyword = fallback.keyword;
      searchIntent   = fallback.intent;
      targetService  = fallback.service;
      dataSourceNote = 'AI tahmini — GSC ve Google Ads bağlı değil';
    }

    // ── Create studio project ──────────────────────────────────────────────
    const config = {
      keywords:        [primaryKeyword],
      searchIntent,
      audience:        'Türkiye\'ye seyahat eden yolcular ve iş dünyası',
      tone:            'Profesyonel ve bilgilendirici',
      wordCountTarget: 1200,
      targetService,
      articleType:     'rehber',
      notes:           `Otomatik oluşturuldu. Kaynak: ${dataSourceNote}`,
    };

    const [project] = await db
      .insert(studioProjects)
      .values({
        contentType:  'blog',
        titleWorking: topicTitle,
        stage:        'research',
        status:       'research',
        config,
      })
      .returning();

    // ── Run Research ───────────────────────────────────────────────────────
    const { runResearch } = await import('@/lib/studio/ai-studio');
    const researchResult = await runResearch(config as Parameters<typeof runResearch>[0]);

    if (!researchResult.ok) {
      await db.update(studioProjects)
        .set({ status: 'draft', stage: 'draft', updatedAt: new Date() })
        .where((await import('drizzle-orm')).eq(studioProjects.id, project.id));
      return NextResponse.json({
        ok: false,
        projectId: project.id,
        error: `Research failed: ${researchResult.message}`,
      }, { status: 500 });
    }

    // Store research rows
    const { studioResearch } = await import('@/db/schema');
    const now = new Date();
    await db.update(studioProjects)
      .set({ stage: 'draft', status: 'research', updatedAt: now })
      .where((await import('drizzle-orm')).eq(studioProjects.id, project.id));

    if (researchResult.data.sources.length > 0) {
      await db.insert(studioResearch).values(
        researchResult.data.sources.map(s => ({
          projectId:    project.id,
          title:        s.title,
          url:          s.url,
          sourceName:   s.sourceType === 'manual' ? 'Manuel' : 'AI Bağlamı',
          sourceType:   s.sourceType,
          claims:       [s.claimSupported],
          accessedAt:   new Date(s.accessedAt),
          notes:        null,
        }))
      ).catch(() => { /* non-fatal */ });
    }

    // ── Generate TR draft ──────────────────────────────────────────────────
    const { generateTrDraft } = await import('@/lib/studio/ai-studio');

    const researchData = {
      summary:      researchResult.data.summary,
      keyAngles:    researchResult.data.keyAngles,
      contentBrief: researchResult.data.contentBrief,
      sources:      researchResult.data.sources,
      keywordNote:  dataSourceNote,
    } as Parameters<typeof generateTrDraft>[1];

    const draftResult = await generateTrDraft(
      config as Parameters<typeof generateTrDraft>[0],
      researchData
    );

    if (!draftResult.ok) {
      await db.update(studioProjects)
        .set({ status: 'draft', stage: 'draft', updatedAt: new Date() })
        .where((await import('drizzle-orm')).eq(studioProjects.id, project.id));
      return NextResponse.json({
        ok: false,
        projectId: project.id,
        error: `Draft generation failed: ${draftResult.message}`,
      }, { status: 500 });
    }

    // Save draft — status = 'draft' (NEVER auto-approved or published)
    await db.update(studioProjects).set({
      trContent: draftResult.data as never,
      stage:     'draft',
      status:    'draft',
      updatedAt: new Date(),
    }).where((await import('drizzle-orm')).eq(studioProjects.id, project.id));

    return NextResponse.json({
      ok: true,
      projectId: project.id,
      title: topicTitle,
      keyword: primaryKeyword,
      dataSource: gscOk ? 'gsc' : 'ai_estimation',
      dataSourceNote,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : 'unknown';
    console.error('[cron/draft-cadence] Draft generation failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Stable bearer-secret trigger. The legacy /weekly-draft endpoint uses this
 * same logic, so an existing weekly external scheduler remains safe.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { aiDraftCadenceRuns, aiDraftCadenceSettings } = await import('@/db/schema');
    const { and, eq } = await import('drizzle-orm');
    const now = new Date();

    await db.insert(aiDraftCadenceSettings).values({
      id: 1,
      ...DEFAULT_DRAFT_CADENCE,
      nextDueAt: getDraftCadenceSlot(now, DEFAULT_DRAFT_CADENCE.period, DEFAULT_DRAFT_CADENCE.timezone).startsAt,
    }).onConflictDoNothing();

    const [stored] = await db.select().from(aiDraftCadenceSettings)
      .where(eq(aiDraftCadenceSettings.id, 1)).limit(1);
    const period = isDraftCadencePeriod(stored?.period) ? stored.period : DEFAULT_DRAFT_CADENCE.period;
    const quantity = stored && Number.isInteger(stored.quantity) && stored.quantity >= 1 && stored.quantity <= 10
      ? stored.quantity
      : DEFAULT_DRAFT_CADENCE.quantity;
    const timezone = stored?.timezone || DEFAULT_DRAFT_CADENCE.timezone;
    const configVersion = stored?.configVersion ?? 1;
    const slot = getDraftCadenceSlot(now, period, timezone);

    if (!isCadenceDue(now, stored?.nextDueAt)) {
      return NextResponse.json({
        ok: true, skipped: true, reason: 'not_due',
        period, quantity, timezone, nextDueAt: stored?.nextDueAt?.toISOString() ?? slot.nextDueAt.toISOString(),
      });
    }

    const [claim] = await db.insert(aiDraftCadenceRuns).values({
      slotKey: slot.key,
      period,
      timezone,
      plannedQuantity: quantity,
      status: 'running',
    }).onConflictDoNothing().returning();

    if (!claim) {
      // A completed (or concurrently running) slot is already sufficient proof
      // that this calendar window was handled. Advance the singleton so a
      // settings re-save cannot leave it perpetually due on the old slot.
      await db.update(aiDraftCadenceSettings).set({
        nextDueAt: slot.nextDueAt,
        updatedAt: now,
      }).where(and(
        eq(aiDraftCadenceSettings.id, 1),
        eq(aiDraftCadenceSettings.configVersion, configVersion),
      ));
      return NextResponse.json({
        ok: true, skipped: true, reason: 'slot_already_claimed',
        slotKey: slot.key, period, quantity, timezone,
      });
    }

    const projectIds: string[] = [];
    const failures: string[] = [];
    for (let ordinal = 0; ordinal < quantity; ordinal += 1) {
      const response = await createAutomaticDraft(uniqueTopicOffset(slot.key, ordinal));
      const result = await response.json() as { ok?: boolean; projectId?: string; error?: string };
      if (response.ok && result.ok && result.projectId) projectIds.push(result.projectId);
      else failures.push(result.error?.slice(0, 160) ?? 'Taslak oluşturulamadı.');
    }

    const completedAt = new Date();
    const status = failures.length === 0 ? 'completed' : 'failed';
    await db.update(aiDraftCadenceRuns).set({
      generatedCount: projectIds.length,
      projectIds,
      status,
      failureMessage: failures.length ? failures.join(' | ').slice(0, 500) : null,
      completedAt,
    }).where(eq(aiDraftCadenceRuns.id, claim.id));
    await db.update(aiDraftCadenceSettings).set({
      lastExecutedAt: completedAt,
      nextDueAt: slot.nextDueAt,
      updatedAt: completedAt,
    }).where(and(
      eq(aiDraftCadenceSettings.id, 1),
      eq(aiDraftCadenceSettings.configVersion, configVersion),
    ));

    return NextResponse.json({
      ok: failures.length === 0,
      slotKey: slot.key,
      period,
      quantity,
      generatedCount: projectIds.length,
      projectIds,
      nextDueAt: slot.nextDueAt.toISOString(),
      status,
    }, { status: failures.length === 0 ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : 'unknown';
    console.error('[cron/draft-cadence] Run failed:', message);
    return NextResponse.json({ ok: false, error: 'Cadenced draft run failed.' }, { status: 500 });
  }
}
