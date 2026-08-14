/**
 * PUT    /admin/api/topic-clusters/[id] — update cluster
 * DELETE /admin/api/topic-clusters/[id] — delete cluster
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  pillarTitle:     z.string().min(1).max(300).optional(),
  clusterArticles: z.array(z.object({
    id: z.string(), slug: z.string(), title: z.string(),
    publishedAt: z.string().nullish(), suggestionId: z.string().nullish(),
  })).optional(),
  suggestedLinks: z.array(z.object({
    from: z.string(), to: z.string(), anchor: z.string(),
  })).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { db }            = await import('@/db');
  const { topicClusters, auditLogs } = await import('@/db/schema');
  const { eq }            = await import('drizzle-orm');

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.pillarTitle    !== undefined) updateData.pillarTitle    = parsed.data.pillarTitle;
  if (parsed.data.clusterArticles !== undefined) updateData.clusterArticles = parsed.data.clusterArticles;
  if (parsed.data.suggestedLinks  !== undefined) updateData.suggestedLinks  = parsed.data.suggestedLinks;

  const [updated] = await db.update(topicClusters)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updateData as any)
    .where(eq(topicClusters.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'UPDATE',
    entityType: 'TopicCluster', entityId: id,
  }).catch(() => {});

  return NextResponse.json({ cluster: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { db }            = await import('@/db');
  const { topicClusters, auditLogs } = await import('@/db/schema');
  const { eq }            = await import('drizzle-orm');

  const [deleted] = await db.delete(topicClusters).where(eq(topicClusters.id, id)).returning({ id: topicClusters.id });
  if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'DELETE',
    entityType: 'TopicCluster', entityId: id,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
