import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { content, studioAudit, studioDistribution, studioProjects } from '@/db/schema';
import { publishGoogleBusinessPost } from '@/lib/google-business';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { SITE } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const { id } = await params;
  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'AI Studio projesi bulunamadı.' }, { status: 404 });
  if (!project.trApprovedAt || !project.cmsEntityId) {
    return NextResponse.json(
      { error: 'Google Business paylaşımı için Türkçe makale önce onaylanıp CMS’e aktarılmalı.' },
      { status: 409 },
    );
  }

  const [article] = await db.select({
    id: content.id,
    slug: content.slug,
  }).from(content).where(and(
    eq(content.id, project.cmsEntityId),
    eq(content.contentType, 'BLOG_POST'),
    eq(content.status, 'PUBLISHED'),
  )).limit(1);
  if (!article) {
    return NextResponse.json(
      { error: 'Google Business paylaşımı için makale önce CMS’te yayımlanmalı.' },
      { status: 409 },
    );
  }

  const [draft] = await db.select().from(studioDistribution).where(and(
    eq(studioDistribution.projectId, id),
    eq(studioDistribution.platform, 'google_business'),
  )).limit(1);
  if (!draft?.content.trim()) {
    return NextResponse.json({ error: 'Önce Google Business dağıtım taslağı üretin.' }, { status: 409 });
  }
  if (draft.status === 'published' && draft.remoteId) {
    return NextResponse.json({
      result: { id: draft.remoteId, url: draft.remoteUrl },
      alreadyPublished: true,
    });
  }

  const articleUrl = `${SITE.siteUrl}/blog/${article.slug}`;
  // Claim the draft before the remote request so repeated clicks, retries, or
  // concurrent admin sessions cannot create duplicate Google Business posts.
  const [claimedDraft] = await db.update(studioDistribution).set({
    status: 'publishing',
    lastError: null,
    retryCount: (draft.retryCount ?? 0) + 1,
    updatedAt: new Date(),
  }).where(and(
    eq(studioDistribution.id, draft.id),
    inArray(studioDistribution.status, ['draft', 'failed']),
  )).returning();
  if (!claimedDraft) {
    return NextResponse.json(
      { error: 'Bu Google Business taslağı başka bir işlem tarafından yayımlanıyor veya zaten yayımlandı.' },
      { status: 409 },
    );
  }

  try {
    const result = await publishGoogleBusinessPost({ text: claimedDraft.content, url: articleUrl });
    const now = new Date();
    await db.update(studioDistribution).set({
      status: 'published',
      remoteId: result.id,
      remoteUrl: result.url,
      lastError: null,
      publishedAt: now,
      updatedAt: now,
    }).where(eq(studioDistribution.id, draft.id));
    await db.insert(studioAudit).values({
      projectId: id,
      adminId: session.adminId,
      action: 'google_business_published',
      detail: { distributionId: draft.id, remoteId: result.id, articleId: article.id },
    });
    return NextResponse.json({ result });
  } catch {
    await db.update(studioDistribution).set({
      status: 'failed',
      lastError: 'google_business_publish_failed',
      updatedAt: new Date(),
    }).where(eq(studioDistribution.id, draft.id));
    await db.insert(studioAudit).values({
      projectId: id,
      adminId: session.adminId,
      action: 'google_business_publish_failed',
      detail: { distributionId: draft.id },
    });
    return NextResponse.json(
      { error: 'Google Business gönderisi yayımlanamadı. Bağlantı, seçili konum ve kanal durumunu kontrol edin.' },
      { status: 502 },
    );
  }
}