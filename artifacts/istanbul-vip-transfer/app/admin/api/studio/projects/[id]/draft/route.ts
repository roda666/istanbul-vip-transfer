/**
 * POST /admin/api/studio/projects/[id]/draft
 * Generate Turkish draft from stored research. Replaces existing trContent (idempotent).
 * Resets TR approval so approval must be re-done after regeneration.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  // Body is optional — research is always read from DB
  try { await req.json(); } catch { /* no body is fine */ }

  try {
    const { db } = await import('@/db');
    const { studioProjects, studioResearch, studioAudit, adminUsers } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
    if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

    // Always build research from DB for reproducibility
    const sources = await db.select().from(studioResearch).where(eq(studioResearch.projectId, id));
    const cfg = project.config as Record<string, unknown>;

    const researchData = {
      summary:     '',
      keyAngles:   [],
      contentBrief: {
        tone:            String(cfg?.tone ?? 'Profesyonel'),
        wordCountTarget: Number(cfg?.wordCountTarget ?? 1200),
        h2Suggestions:   [],
        faqTopics:       [],
        internalLinkSuggestions: [],
      },
      sources: sources.map(s => ({
        title:          s.title ?? '',
        url:            s.url,
        claimSupported: (s.claims as string[])[0] ?? '',
        sourceType:     (s.sourceType === 'manual' ? 'manual' : 'ai_context') as 'ai_context' | 'manual',
        accessedAt:     (s.accessedAt ?? new Date()).toISOString(),
      })),
      keywordNote: 'Anahtar kelime verisi bağlı değil — AI tahmini',
    } as Parameters<typeof import('@/lib/studio/ai-studio').generateTrDraft>[1];

    const { generateTrDraft } = await import('@/lib/studio/ai-studio');
    const config = (project.config ?? {}) as unknown as Parameters<typeof generateTrDraft>[0];
    const result = await generateTrDraft(config, researchData);

    if (!result.ok) {
      return NextResponse.json({
        error: result.message,
        reason: result.reason,
        retryable: result.reason !== 'not_configured',
      }, { status: result.reason === 'not_configured' ? 503 : 500 });
    }

    const now = new Date();

    // Save draft — reset TR approval (content changed)
    await db.update(studioProjects).set({
      trContent:    result.data as never,
      stage:        'draft',
      status:       'draft',
      trApprovedAt: null,
      trApprovedBy: null,
      updatedAt:    now,
    }).where(eq(studioProjects.id, id));

    const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.id, session.adminId as never)).limit(1);

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'draft_generated',
      detail: {
        model:     result.model,
        tokens:    result.tokens ?? 0,
        wordCount: result.data.wordCount,
      } as Record<string, unknown>,
      createdAt: now,
    });

    return NextResponse.json({ content: result.data, model: result.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'Beklenmeyen hata.';
    console.error('[studio/draft]', msg);
    return NextResponse.json({ error: `Taslak oluşturma başarısız: ${msg}`, retryable: true }, { status: 500 });
  }
}
