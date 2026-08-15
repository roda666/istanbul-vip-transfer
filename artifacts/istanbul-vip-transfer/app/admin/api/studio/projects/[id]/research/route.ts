/**
 * POST /admin/api/studio/projects/[id]/research
 * Run AI research for the project. Saves sources to studio_research.
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
  const { studioProjects, studioResearch, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [project] = await db.select().from(studioProjects).where(eq(studioProjects.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });

  const { runResearch } = await import('@/lib/studio/ai-studio');
  const config = (project.config ?? {}) as unknown as Parameters<typeof runResearch>[0];

  const result = await runResearch(config);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.reason === 'not_configured' ? 503 : 500 });
  }

  const now = new Date();

  // Delete old research for this project
  await db.delete(studioResearch).where(eq(studioResearch.projectId, id));

  // Insert new sources
  if (result.data.sources.length > 0) {
    await db.insert(studioResearch).values(
      result.data.sources.map(s => ({
        projectId:  id,
        url:        s.url,
        title:      s.title,
        accessedAt: new Date(s.accessedAt),
        claims:     [s.claimSupported].filter(Boolean),
        sourceType: s.sourceType,
        createdAt:  now,
      }))
    );
  }

  // Advance stage to 'research'
  await db.update(studioProjects).set({
    stage:     'research',
    updatedAt: now,
  }).where(eq(studioProjects.id, id));

  // Audit
  const [admin] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(eq(adminUsers.id, session.adminId as never)).limit(1);
  await db.insert(studioAudit).values({
    projectId: id, adminId: admin?.id ?? null,
    action: 'research_completed',
    detail: { model: result.model, tokens: result.tokens ?? 0, sourceCount: result.data.sources.length },
    createdAt: now,
  });

  return NextResponse.json({ research: result.data, model: result.model });
}
