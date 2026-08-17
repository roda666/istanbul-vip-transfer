/**
 * POST /admin/api/studio/projects/[id]/approve
 * Approve or reject the Turkish draft.
 *
 * On APPROVE:
 *  1. Marks trApprovedAt in DB (synchronous — fast).
 *  2. Returns 200 immediately.
 *  3. Background (Next.js after()): translates all 8 languages → auto-approves
 *     → exports to CMS → publishes TR + all 8 langs.
 *
 * On REJECT: resets to draft stage.
 * Idempotent approve: repeated calls with same state are no-ops.
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  let body: { action?: string; notes?: string } = {};
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 }); }

  if (!body.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: '"action" alanı "approve" veya "reject" olmalıdır.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const [project] = await db.select({
      id:           studioProjects.id,
      trContent:    studioProjects.trContent,
      trApprovedAt: studioProjects.trApprovedAt,
      config:       studioProjects.config,
      contentType:  studioProjects.contentType,
      coverImageUrl: studioProjects.coverImageUrl,
      coverImageAlt: studioProjects.coverImageAlt,
    }).from(studioProjects).where(eq(studioProjects.id, id)).limit(1);

    if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    if (!project.trContent) return NextResponse.json({ error: 'Onaylanacak Türkçe taslak yok.' }, { status: 400 });

    const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.id, session.adminId as never)).limit(1);

    const now = new Date();

    if (body.action === 'approve') {
      // Idempotent: if already approved, skip DB write but still return ok
      if (project.trApprovedAt) {
        return NextResponse.json({ ok: true, status: 'approved', alreadyApproved: true });
      }

      await db.update(studioProjects).set({
        trApprovedAt: now,
        trApprovedBy: admin?.id ?? null,
        status:       'approved',
        stage:        'translations',
        updatedAt:    now,
      }).where(eq(studioProjects.id, id));

      await db.insert(studioAudit).values({
        projectId: id, adminId: admin?.id ?? null,
        action: 'tr_draft_approved',
        detail: { notes: body.notes ?? null } as Record<string, unknown>,
        createdAt: now,
      });

      // ── Background: translate → auto-approve → export → publish ──────────
      after(async () => {
        try {
          await runAutoPublishPipeline({
            projectId:    id,
            trContent:    project.trContent as unknown as import('@/lib/studio/types').StudioContent,
            config:       project.config as unknown as import('@/lib/studio/types').StudioConfig,
            contentType:  (project.contentType ?? 'blog') as 'blog' | 'service',
            coverImageUrl: project.coverImageUrl,
            coverImageAlt: project.coverImageAlt,
            adminId:      admin?.id ?? null,
          });
        } catch (err) {
          console.error('[approve/after] Pipeline error:', err instanceof Error ? err.message : err);
        }
      });

      return NextResponse.json({ ok: true, status: 'approved', autoPublishing: true });
    }

    // ── REJECT ─────────────────────────────────────────────────────────────
    await db.update(studioProjects).set({
      trApprovedAt: null,
      trApprovedBy: null,
      status:       'draft',
      stage:        'draft',
      updatedAt:    now,
    }).where(eq(studioProjects.id, id));

    await db.insert(studioAudit).values({
      projectId: id, adminId: admin?.id ?? null,
      action: 'tr_draft_rejected',
      detail: { notes: body.notes ?? null } as Record<string, unknown>,
      createdAt: now,
    });

    return NextResponse.json({ ok: true, status: 'rejected' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'Beklenmeyen hata.';
    console.error('[studio/approve]', msg);
    return NextResponse.json({ error: `Onay işlemi başarısız: ${msg}` }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background pipeline: translate all 8 langs → auto-approve → CMS export → publish
// Runs AFTER the HTTP response is returned via Next.js after().
// Non-fatal errors are logged but do not crash the pipeline.
// ─────────────────────────────────────────────────────────────────────────────

async function runAutoPublishPipeline(opts: {
  projectId: string;
  trContent: import('@/lib/studio/types').StudioContent;
  config: import('@/lib/studio/types').StudioConfig;
  contentType: 'blog' | 'service';
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  adminId: string | null;
}) {
  const { db }                     = await import('@/db');
  const { studioProjects, studioProjectTranslations, studioAudit, content, contentTranslations } = await import('@/db/schema');
  const { eq, and, inArray }       = await import('drizzle-orm');
  const { translateStudioContent } = await import('@/lib/studio/ai-studio');
  const { exportStudioToCms }      = await import('@/lib/studio/export-to-cms');
  const { TARGET_LANGS }           = await import('@/lib/studio/types');

  const { projectId, trContent, config, contentType, coverImageUrl, coverImageAlt, adminId } = opts;
  const now = () => new Date();

  // ── 1. Translate all 8 target languages ──────────────────────────────────
  console.log(`[auto-publish] Starting translations for project ${projectId}`);
  const translationResults: Array<{ lang: string; ok: boolean; content?: import('@/lib/studio/types').StudioContent }> = [];

  for (const lang of TARGET_LANGS) {
    try {
      const result = await translateStudioContent(trContent, lang);
      if (result.ok) {
        translationResults.push({ lang, ok: true, content: result.data });

        // Upsert into studio_project_translations
        const existing = await db.select({ id: studioProjectTranslations.id })
          .from(studioProjectTranslations)
          .where(and(
            eq(studioProjectTranslations.projectId, projectId),
            eq(studioProjectTranslations.lang, lang),
          )).limit(1);

        if (existing.length > 0) {
          await db.update(studioProjectTranslations).set({
            content:    result.data as never,
            status:     'approved',
            approvedAt: now(),
            approvedBy: adminId as never,
            updatedAt:  now(),
          }).where(eq(studioProjectTranslations.id, existing[0].id));
        } else {
          await db.insert(studioProjectTranslations).values({
            projectId,
            lang,
            content:    result.data as never,
            status:     'approved',
            approvedAt: now(),
            approvedBy: adminId as never,
            createdAt:  now(),
            updatedAt:  now(),
          });
        }
        console.log(`[auto-publish] ✅ ${lang} translated + approved`);
      } else {
        translationResults.push({ lang, ok: false });
        console.warn(`[auto-publish] ⚠️ ${lang} translation failed: ${result.message}`);
      }
    } catch (err) {
      translationResults.push({ lang, ok: false });
      console.error(`[auto-publish] ❌ ${lang} error:`, err instanceof Error ? err.message : err);
    }
  }

  // ── 2. Export TR content to CMS ───────────────────────────────────────────
  const [project] = await db.select({
    id: studioProjects.id,
    cmsEntityId: studioProjects.cmsEntityId,
  }).from(studioProjects).where(eq(studioProjects.id, projectId)).limit(1);

  if (!project) {
    console.error('[auto-publish] Project not found during export step.');
    return;
  }

  let cmsEntityId = project.cmsEntityId;

  if (!cmsEntityId) {
    const exportResult = await exportStudioToCms({
      contentType, trContent, config, coverImageUrl, coverImageAlt,
    });
    if (exportResult.ok) {
      cmsEntityId = exportResult.cmsEntityId;
      await db.update(studioProjects).set({
        cmsEntityId:   exportResult.cmsEntityId,
        cmsEntityType: exportResult.cmsEntityType,
        stage:         'review',
        updatedAt:     now(),
      }).where(eq(studioProjects.id, projectId));
      console.log(`[auto-publish] ✅ Exported to CMS: ${exportResult.slug}`);
    } else {
      console.error('[auto-publish] ❌ CMS export failed:', exportResult.error);
      return;
    }
  }

  // ── 3. Publish TR in CMS ──────────────────────────────────────────────────
  await db.update(content).set({
    status:    'PUBLISHED' as const,
    indexable: true,
    isActive:  true,
    publishedAt: now(),
    updatedAt: now(),
  }).where(eq(content.id, cmsEntityId!));
  console.log('[auto-publish] ✅ TR published to CMS');

  // ── 4. Publish translations (approved ones) ────────────────────────────────
  const approvedLangs = translationResults.filter(r => r.ok).map(r => r.lang);

  for (const lang of approvedLangs) {
    const [trans] = await db.select()
      .from(studioProjectTranslations)
      .where(and(
        eq(studioProjectTranslations.projectId, projectId),
        eq(studioProjectTranslations.lang, lang),
      )).limit(1);

    if (!trans?.content) continue;

    const c = trans.content as unknown as import('@/lib/studio/types').StudioContent;

    // Upsert into content_translations
    try {
      const existing = await db.select({ id: contentTranslations.id })
        .from(contentTranslations)
        .where(and(
          eq(contentTranslations.entityType, 'content'),
          eq(contentTranslations.entityId, cmsEntityId!),
          eq(contentTranslations.targetLanguageCode, lang),
        )).limit(1);

      const values = {
        entityType:         'content' as const,
        entityId:           cmsEntityId!,
        sourceLanguageCode: 'tr',
        targetLanguageCode: lang,
        status:             'PUBLISHED' as const,
        title:              c.title ?? '',
        slug:               c.slug  ?? '',
        excerpt:            c.excerpt ?? '',
        body:               c.bodyMd ?? '',
        metaTitle:          c.ogTitle ?? c.title ?? '',
        metaDescription:    c.ogDescription ?? c.excerpt ?? '',
        imageAlt:           c.ogImageAlt ?? '',
        isAiGenerated:      true,
        aiModel:            'gpt-5.4-mini',
        publishedAt:        now(),
        updatedAt:          now(),
      };

      if (existing.length > 0) {
        await db.update(contentTranslations)
          .set({ ...values, updatedAt: now() })
          .where(eq(contentTranslations.id, existing[0].id));
      } else {
        await db.insert(contentTranslations).values({ ...values, createdAt: now() });
      }
      console.log(`[auto-publish] ✅ ${lang} published to content_translations`);
    } catch (err) {
      console.error(`[auto-publish] ❌ ${lang} publish error:`, err instanceof Error ? err.message : err);
    }
  }

  // ── 5. Mark project as published ─────────────────────────────────────────
  await db.update(studioProjects).set({
    stage:       'published',
    status:      'published',
    publishedAt: now(),
    updatedAt:   now(),
  }).where(eq(studioProjects.id, projectId));

  await db.insert(studioAudit).values({
    projectId, adminId: adminId as never,
    action: 'auto_published',
    detail: {
      langs: approvedLangs,
      cmsEntityId,
      failedLangs: translationResults.filter(r => !r.ok).map(r => r.lang),
    } as Record<string, unknown>,
    createdAt: now(),
  });

  console.log(`[auto-publish] ✅ Pipeline complete for project ${projectId}. Published: TR + ${approvedLangs.join(', ')}`);
}
