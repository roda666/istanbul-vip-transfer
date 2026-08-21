/**
 * POST /admin/api/studio/projects/[id]/publish
 * Manually publish approved translations (and/or TR) immediately.
 * Body: { langs: string[] }  — must all be 'approved' status.
 * Includes tr if langs contains 'tr'.
 * Idempotency guard: cannot publish already-published translations.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSessionErrorMessage,
  getAdminSessionErrorStatus,
  requireAdminSession,
} from '@/lib/auth/session';
import { hasAdminPermission } from '@/lib/auth/authorization';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch (error) {
    const status = getAdminSessionErrorStatus(error);
    return NextResponse.json({ error: getAdminSessionErrorMessage(status) }, { status });
  }
  if (!hasAdminPermission(session.role, 'CONTENT_PUBLISH')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { langs?: string[] };
  if (!body.langs || body.langs.length === 0) {
    return NextResponse.json({ error: 'Yayınlanacak dil listesi boş.' }, { status: 400 });
  }

  const { db } = await import('@/db');
  const {
    studioProjects, studioProjectTranslations,
    studioAudit, adminUsers, content, contentTranslations,
  } = await import('@/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  if (!project.cmsEntityId) {
    return NextResponse.json({ error: "Önce içeriği CMS'e aktarın (Export)." }, { status: 400 });
  }

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const now = new Date();
  const results: Array<{ lang: string; ok: boolean; error?: string }> = [];
  const targetLangs = body.langs.filter(l => l !== 'tr');
  const includeTr   = body.langs.includes('tr');

  // ── Publish TR content ────────────────────────────────────────────────────
  if (includeTr) {
    if (!project.trApprovedAt) {
      results.push({ lang: 'tr', ok: false, error: 'Türkçe taslak onaylanmamış.' });
    } else {
      try {
        await db.update(content).set({
          status:    'PUBLISHED' as const,
          indexable: true,
          isActive:  true,
          updatedAt: now,
        }).where(eq(content.id, project.cmsEntityId));
        results.push({ lang: 'tr', ok: true });
      } catch (e) {
        results.push({ lang: 'tr', ok: false, error: String(e) });
      }
    }
  }

  // ── Publish translations ──────────────────────────────────────────────────
  if (targetLangs.length > 0) {
    const translations = await db.select().from(studioProjectTranslations)
      .where(and(
        eq(studioProjectTranslations.projectId, id),
        inArray(studioProjectTranslations.lang, targetLangs),
      ));

    for (const lang of targetLangs) {
      const trans = translations.find(t => t.lang === lang);
      if (!trans) {
        results.push({ lang, ok: false, error: 'Çeviri bulunamadı.' });
        continue;
      }
      if (trans.status !== 'approved') {
        results.push({ lang, ok: false, error: 'Çeviri onaylanmamış — yayınlanamaz.' });
        continue;
      }

      try {
        const transContent = trans.content as { bodyMd?: string; title?: string; slug?: string; excerpt?: string; metaTitle?: string; metaDescription?: string } | null;
        if (!transContent) { results.push({ lang, ok: false, error: 'Çeviri içeriği boş.' }); continue; }

        // Convert markdown to simple HTML
        const bodyHtml = (transContent.bodyMd ?? '')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // contentTranslations uses entityType + entityId + targetLanguageCode
        const existingTrans = await db.select({ id: contentTranslations.id })
          .from(contentTranslations)
          .where(and(
            eq(contentTranslations.entityType, 'content'),
            eq(contentTranslations.entityId, project.cmsEntityId),
            eq(contentTranslations.targetLanguageCode, lang),
          )).limit(1);

        const updateValues = {
          title:              transContent.title ?? null,
          slug:               transContent.slug ?? null,
          excerpt:            transContent.excerpt ?? null,
          body:               bodyHtml || null,
          metaTitle:          transContent.metaTitle ?? null,
          metaDescription:    transContent.metaDescription ?? null,
          status:             'PUBLISHED' as const,
          isManuallyLocked:   false,
          updatedAt:          now,
        };

        if (existingTrans.length > 0) {
          await db.update(contentTranslations)
            .set(updateValues)
            .where(eq(contentTranslations.id, existingTrans[0].id));
        } else {
          await db.insert(contentTranslations).values({
            entityType:          'content',
            entityId:            project.cmsEntityId,
            sourceLanguageCode:  'tr',
            targetLanguageCode:  lang,
            isAiGenerated:       true,
            createdAt:           now,
            ...updateValues,
          });
        }

        // Mark studio translation as published
        await db.update(studioProjectTranslations).set({
          status: 'published', publishedAt: now, updatedAt: now,
        }).where(eq(studioProjectTranslations.id, trans.id));

        results.push({ lang, ok: true });
      } catch (e) {
        results.push({ lang, ok: false, error: String(e) });
      }
    }
  }

  // Update project status if TR was included and published ok
  const allOk = results.every(r => r.ok);
  if (allOk && includeTr) {
    await db.update(studioProjects).set({
      status:      'published',
      publishedAt: now,
      stage:       'published',
      updatedAt:   now,
    }).where(eq(studioProjects.id, id));
  }

  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'published',
    detail: { langs: body.langs, results } as Record<string, unknown>,
    createdAt: now,
  });

  return NextResponse.json({ results });
}
