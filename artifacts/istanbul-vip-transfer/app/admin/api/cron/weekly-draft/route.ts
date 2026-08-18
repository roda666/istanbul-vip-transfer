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

export const dynamic = 'force-dynamic';

// Pre-defined fallback topics when GSC is not connected
const FALLBACK_TOPICS = [
  { title: 'İstanbul Havalimanı VIP Karşılama Hizmeti: İlk İzlenim Rehberi', keyword: 'istanbul havalimanı karşılama hizmeti', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'Kurumsal VIP Transfer: Şirket Misafiri Ağırlama Rehberi', keyword: 'kurumsal vip transfer istanbul', intent: 'commercial', service: 'kurumsal transfer' },
  { title: 'İstanbul Düğün Transferi: Gelin Arabası Alternatifleri', keyword: 'istanbul düğün transfer aracı', intent: 'commercial', service: 'özel etkinlik transferi' },
  { title: 'Gece Geç Saatte İstanbul Havalimanı Transferi: Güvenli Seçenekler', keyword: 'gece havalimanı transfer istanbul', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'İstanbul\'dan Ankara\'ya VIP Araç Kiralama Karşılaştırması', keyword: 'istanbul ankara vip araç kiralama', intent: 'commercial', service: 'şehirlerarası transfer' },
  { title: 'Sabiha Gökçen Havalimanı Karşılama Hizmetleri: Kapsamlı Rehber', keyword: 'sabiha gökçen karşılama hizmeti', intent: 'informational', service: 'havalimanı transferi' },
  { title: 'VIP Transfer Rezervasyonu İpuçları: Seyahat Öncesi Bilinmesi Gerekenler', keyword: 'vip transfer rezervasyon ipuçları', intent: 'informational', service: 'vip transfer' },
];

export async function POST(req: NextRequest) {
  // ── Auth: CRON_SECRET check ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { studioProjects } = await import('@/db/schema');
    const { desc, gte } = await import('drizzle-orm');

    // ── Idempotency: skip if draft created in last 5 days ─────────────────
    const since = new Date(Date.now() - 5 * 86_400_000);
    const [recent] = await db
      .select({ id: studioProjects.id, createdAt: studioProjects.createdAt })
      .from(studioProjects)
      .where(gte(studioProjects.createdAt, since))
      .orderBy(desc(studioProjects.createdAt))
      .limit(1);

    if (recent) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `Recent draft already exists (id: ${recent.id}, created: ${recent.createdAt?.toISOString()})`,
      });
    }

    // ── Pick topic ─────────────────────────────────────────────────────────
    let topicTitle: string;
    let primaryKeyword: string;
    let searchIntent: string;
    let targetService: string;
    let dataSourceNote: string;

    const { isGscConnected, findKeywordOpportunities } = await import('@/lib/gsc');
    const gscOk = await isGscConnected();

    if (gscOk) {
      const opResult = await findKeywordOpportunities(5);
      if (opResult.ok && opResult.opportunities.length > 0) {
        const top = opResult.opportunities[0];
        primaryKeyword = top.query;
        topicTitle     = `${top.query.charAt(0).toUpperCase() + top.query.slice(1)} — Kapsamlı Rehber`;
        searchIntent   = top.reason === 'low_ctr' ? 'informational' : 'commercial';
        targetService  = 'vip transfer';
        dataSourceNote = `Google Search Console verisi: ${top.impressions.toLocaleString('tr-TR')} gösterim, %${(top.ctr * 100).toFixed(1)} CTR`;
      } else {
        // GSC connected but no data yet — fall back
        if (gscOk) console.warn('[cron/weekly-draft] GSC connected but no opportunity data:', opResult);
          const fallback = FALLBACK_TOPICS[new Date().getDay() % FALLBACK_TOPICS.length];
        topicTitle     = fallback.title;
        primaryKeyword = fallback.keyword;
        searchIntent   = fallback.intent;
        targetService  = fallback.service;
        dataSourceNote = 'AI tahmini — GSC veri yetersiz';
      }
    } else {
      const fallback = FALLBACK_TOPICS[new Date().getDay() % FALLBACK_TOPICS.length];
      topicTitle     = fallback.title;
      primaryKeyword = fallback.keyword;
      searchIntent   = fallback.intent;
      targetService  = fallback.service;
      dataSourceNote = 'AI tahmini — GSC bağlı değil';
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
    console.error('[cron/weekly-draft] Fatal error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
