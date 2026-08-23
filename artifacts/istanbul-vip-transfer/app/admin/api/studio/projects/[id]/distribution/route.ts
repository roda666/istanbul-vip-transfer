/**
 * GET  /admin/api/studio/projects/[id]/distribution  — list distribution drafts
 * POST /admin/api/studio/projects/[id]/distribution  — generate distribution drafts
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioDistribution } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const drafts = await db.select().from(studioDistribution).where(eq(studioDistribution.projectId, id));
  return NextResponse.json({ drafts });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db } = await import('@/db');
  const { studioProjects, studioDistribution, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
  if (!project.trContent) {
    return NextResponse.json({ error: 'Dağıtım taslakları için Türkçe içerik gerekli.' }, { status: 400 });
  }

  const { generateDistributionDrafts } = await import('@/lib/studio/ai-studio');
  const result = await generateDistributionDrafts(project.trContent as unknown as import('@/lib/studio/types').StudioContent);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.reason === 'not_configured' ? 503 : 500 });
  }

  const now = new Date();
  const platforms = ['newsletter', 'instagram', 'facebook', 'twitter', 'linkedin', 'google_business'] as const;

  // Upsert each platform
  for (const platform of platforms) {
    // Google Business Profile accepts the same concise, link-first copy as
    // Facebook. It remains a draft until an administrator explicitly publishes it.
    const platformContent = platform === 'google_business'
      ? result.data.facebook
      : result.data[platform as Exclude<typeof platform, 'google_business'>];
    await db.insert(studioDistribution).values({
      projectId: id,
      platform,
      content:   platformContent,
      status:    'draft',
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target:  [studioDistribution.projectId, studioDistribution.platform],
      set:     {
        content: platformContent,
        status: 'draft',
        remoteId: null,
        remoteUrl: null,
        lastError: null,
        publishedAt: null,
        updatedAt: now,
      },
    } as never);
  }

  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'distribution_generated',
    detail: { model: result.model, platforms: platforms.join(',') },
    createdAt: now,
  });

  return NextResponse.json({ drafts: result.data });
}
