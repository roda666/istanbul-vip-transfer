/**
 * GET  /admin/api/studio/projects/[id]/translations  — list all translations
 * POST /admin/api/studio/projects/[id]/translations  — start AI translation for selected langs
 *   Body: { langs: string[] }
 *   Guard: TR draft must be approved first.
 *   Idempotent: existing translations are replaced, not duplicated.
 *   Partial failures: failed langs are reported; successful ones are saved.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { TARGET_LANGS } from '@/lib/studio/types';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  try {
    const { db } = await import('@/db');
    const { studioProjectTranslations } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const translations = await db.select().from(studioProjectTranslations)
      .where(eq(studioProjectTranslations.projectId, id))
      .orderBy(desc(studioProjectTranslations.updatedAt));

    return NextResponse.json({ translations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'Hata.';
    return NextResponse.json({ error: `Çeviriler alınamadı: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  let body: { langs?: string[] } = {};
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 }); }

  const reqLangs = (body.langs ?? [...TARGET_LANGS])
    .filter(l => TARGET_LANGS.includes(l as typeof TARGET_LANGS[number]));

  if (reqLangs.length === 0) {
    return NextResponse.json({ error: 'Geçerli hedef dil seçilmedi. Desteklenen: ' + TARGET_LANGS.join(', ') }, { status: 400 });
  }

  try {
    const { db } = await import('@/db');
    const { studioProjects, studioProjectTranslations, studioAudit, adminUsers } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const [project] = await db.select({
      id:           studioProjects.id,
      trApprovedAt: studioProjects.trApprovedAt,
      trContent:    studioProjects.trContent,
    }).from(studioProjects).where(eq(studioProjects.id, id)).limit(1);

    if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

    // ── GUARD: Turkish draft must be approved ───────────────────────────────
    if (!project.trApprovedAt) {
      return NextResponse.json({
        error: 'Çeviri başlatmadan önce Türkçe taslağı onaylamanız gerekiyor.',
        action: 'Taslak sekmesinden "Onayla" butonuna tıklayın.',
      }, { status: 400 });
    }
    if (!project.trContent) {
      return NextResponse.json({ error: 'Türkçe taslak içeriği mevcut değil.' }, { status: 400 });
    }

    const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.id, session.adminId as never)).limit(1);

    const { translateStudioContent } = await import('@/lib/studio/ai-studio');
    const trContent = project.trContent as unknown as import('@/lib/studio/types').StudioContent;
    const results: Array<{ lang: string; status: 'draft' | 'error'; error?: string; tokens?: number }> = [];
    const now = new Date();

    // Process languages sequentially to avoid rate limit bursts
    for (const lang of reqLangs) {
      try {
        const result = await translateStudioContent(trContent, lang);

        if (result.ok) {
          // Upsert — check-then-insert with conflict handling
          const existing = await db.select({ id: studioProjectTranslations.id })
            .from(studioProjectTranslations)
            .where(and(
              eq(studioProjectTranslations.projectId, id),
              eq(studioProjectTranslations.lang, lang),
            ))
            .limit(1);

          if (existing.length > 0) {
            await db.update(studioProjectTranslations).set({
              content:     result.data as never,
              status:      'draft',
              approvedAt:  null,
              approvedBy:  null,
              publishedAt: null,
              aiModel:     result.model,
              aiTokens:    result.tokens ?? 0,
              updatedAt:   now,
            }).where(eq(studioProjectTranslations.id, existing[0].id));
          } else {
            await db.insert(studioProjectTranslations).values({
              projectId: id,
              lang,
              content:   result.data as never,
              status:    'draft',
              aiModel:   result.model,
              aiTokens:  result.tokens ?? 0,
              createdAt: now,
              updatedAt: now,
            });
          }

          results.push({ lang, status: 'draft', tokens: result.tokens });
        } else {
          // Partial failure — mark error but continue other languages
          results.push({ lang, status: 'error', error: result.message });
        }
      } catch (langErr: unknown) {
        const msg = langErr instanceof Error ? langErr.message.slice(0, 150) : 'Beklenmeyen hata.';
        results.push({ lang, status: 'error', error: msg });
      }
    }

    // Advance stage if any succeeded
    const anyOk = results.some(r => r.status === 'draft');
    if (anyOk) {
      await db.update(studioProjects).set({ stage: 'translations', updatedAt: now })
        .where(eq(studioProjects.id, id));
    }

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'translations_started',
      detail: {
        langs:     reqLangs,
        succeeded: results.filter(r => r.status === 'draft').map(r => r.lang),
        failed:    results.filter(r => r.status === 'error').map(r => ({ lang: r.lang, error: r.error })),
      } as Record<string, unknown>,
      createdAt: now,
    });

    const failedCount = results.filter(r => r.status === 'error').length;
    return NextResponse.json({
      results,
      summary: failedCount === 0
        ? `${reqLangs.length} dil başarıyla çevrildi.`
        : `${reqLangs.length - failedCount} dil çevrildi, ${failedCount} dil başarısız.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'Beklenmeyen hata.';
    console.error('[studio/translations]', msg);
    return NextResponse.json({ error: `Çeviri işlemi başarısız: ${msg}`, retryable: true }, { status: 500 });
  }
}
