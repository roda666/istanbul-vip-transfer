/**
 * GET  /admin/api/topic-clusters — list all clusters
 * POST /admin/api/topic-clusters — create a new cluster
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  pillarSlug:      z.string().min(1).max(200),
  pillarTitle:     z.string().min(1).max(300),
  clusterArticles: z.array(z.object({
    id: z.string(), slug: z.string(), title: z.string(),
    publishedAt: z.string().nullish(), suggestionId: z.string().nullish(),
  })).optional().default([]),
  suggestedLinks: z.array(z.object({
    from: z.string(), to: z.string(), anchor: z.string(),
  })).optional().default([]),
});

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { db }           = await import('@/db');
  const { topicClusters } = await import('@/db/schema');
  const { desc }         = await import('drizzle-orm');

  const rows = await db.select().from(topicClusters).orderBy(desc(topicClusters.updatedAt));
  return NextResponse.json({ clusters: rows });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { db }           = await import('@/db');
  const { topicClusters, auditLogs } = await import('@/db/schema');

  const [cluster] = await db.insert(topicClusters).values({
    pillarSlug:      parsed.data.pillarSlug,
    pillarTitle:     parsed.data.pillarTitle,
    clusterArticles: parsed.data.clusterArticles,
    suggestedLinks:  parsed.data.suggestedLinks,
    createdBy:       session.adminId,
  } as never).returning();

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'CREATE',
    entityType: 'TopicCluster', entityId: cluster.id,
  }).catch(() => {});

  return NextResponse.json({ cluster }, { status: 201 });
}
