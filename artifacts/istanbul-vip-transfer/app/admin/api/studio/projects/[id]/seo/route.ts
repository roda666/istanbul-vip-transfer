/**
 * POST /admin/api/studio/projects/[id]/seo
 * Run SEO quality check on the current TR draft.
 * Checks slug conflicts with existing published pages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioProjects, studioResearch, studioAudit, adminUsers, content } = await import('@/db/schema');
  const { eq, ne } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  const trContent = project.trContent as import('@/lib/studio/types').StudioContent | null;
  if (!trContent) {
    return NextResponse.json({ error: 'Türkçe taslak henüz oluşturulmamış.' }, { status: 400 });
  }

  // Fetch existing slugs (excluding current CMS entity if any)
  const existingPages = await db.select({ slug: content.slug }).from(content)
    .where(project.cmsEntityId ? ne(content.id, project.cmsEntityId as never) : undefined);
  const existingSlugs = existingPages.map(p => p.slug);

  // Fetch source count
  const sources = await db.select().from(studioResearch).where(eq(studioResearch.projectId, id));

  const { runSeoCheck } = await import('@/lib/studio/ai-studio');
  const score = runSeoCheck(trContent, sources.length, existingSlugs);

  // Cannibalization check
  const slug = trContent.slug;
  const conflicting = existingPages.filter(p => p.slug === slug || p.slug.startsWith(slug.slice(0, -3)));
  const cannibalization = {
    hasConflict: conflicting.length > 0,
    conflictingPages: conflicting.map(p => ({ slug: p.slug, title: p.slug })),
  };

  const now = new Date();
  await db.update(studioProjects).set({
    seoScore:       score as never,
    cannibalization: cannibalization as never,
    stage:          'seo_check',
    updatedAt:      now,
  }).where(eq(studioProjects.id, id));

  // Audit
  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'seo_checked',
    detail: { overallScore: score.overallScore, hasConflict: cannibalization.hasConflict },
    createdAt: now,
  });

  return NextResponse.json({ score, cannibalization });
}
