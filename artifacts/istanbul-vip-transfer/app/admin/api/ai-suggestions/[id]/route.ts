import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  suggestedTitle:    z.string().max(300).optional().nullable(),
  primaryKeyword:    z.string().max(200).optional().nullable(),
  secondaryKeywords: z.string().max(500).optional().nullable(),
  searchIntent:      z.string().max(100).optional().nullable(),
  articleType:       z.string().max(100).optional().nullable(),
  targetService:     z.string().max(200).optional().nullable(),
  targetLocation:    z.string().max(200).optional().nullable(),
  customerProfile:   z.string().max(300).optional().nullable(),
  targetCountry:     z.string().max(100).optional().nullable(),
  targetLanguage:    z.string().max(10).optional(),
  topicClusterId:    z.string().uuid().optional().nullable(),
  status:            z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE', 'REJECTED']).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try { await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  try {
    const { db } = await import('@/db');
    const { aiContentSuggestions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [item] = await db.select().from(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).limit(1);
    if (!item) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error('AI suggestion fetch error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { aiContentSuggestions, auditLogs, topicClusters } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    // Fetch current row to know old topicClusterId before update
    const [before] = await db.select({ topicClusterId: aiContentSuggestions.topicClusterId, suggestedTitle: aiContentSuggestions.suggestedTitle, suggestedSlug: aiContentSuggestions.suggestedSlug, draftBlogPostId: aiContentSuggestions.draftBlogPostId }).from(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).limit(1);
    if (!before) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [updated] = await db.update(aiContentSuggestions).set({ ...parsed.data, updatedAt: new Date() } as any).where(eq(aiContentSuggestions.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    // ── Sync cluster_articles when topicClusterId changes ─────────────────────
    const newClusterId = 'topicClusterId' in parsed.data ? parsed.data.topicClusterId : undefined;
    if (newClusterId !== undefined && newClusterId !== before.topicClusterId) {
      const articleEntry = {
        id: id,
        slug: before.suggestedSlug ?? id,
        title: before.suggestedTitle ?? '(başlıksız)',
        suggestionId: id,
      };

      // Remove from old cluster if existed
      if (before.topicClusterId) {
        const [oldCluster] = await db.select({ clusterArticles: topicClusters.clusterArticles }).from(topicClusters).where(eq(topicClusters.id, before.topicClusterId)).limit(1);
        if (oldCluster) {
          const filtered = (oldCluster.clusterArticles ?? []).filter((a) => a.id !== id);
          await db.update(topicClusters).set({ clusterArticles: filtered, updatedAt: new Date() } as never).where(eq(topicClusters.id, before.topicClusterId));
        }
      }

      // Add to new cluster if specified
      if (newClusterId) {
        const [newCluster] = await db.select({ clusterArticles: topicClusters.clusterArticles }).from(topicClusters).where(eq(topicClusters.id, newClusterId)).limit(1);
        if (newCluster) {
          const existing = (newCluster.clusterArticles ?? []).filter((a) => a.id !== id);
          const updatedArticles = [...existing, articleEntry];
          await db.update(topicClusters).set({ clusterArticles: updatedArticles, updatedAt: new Date() } as never).where(eq(topicClusters.id, newClusterId));
        }
      }

      // Suppress unused import warning
      void sql`SELECT 1`;
    }

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'AISuggestion', entityId: id }).catch(() => {});
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('AI suggestion update error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  try {
    const { db } = await import('@/db');
    const { aiContentSuggestions, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [deleted] = await db.delete(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).returning({ id: aiContentSuggestions.id });
    if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'AISuggestion', entityId: id }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('AI suggestion delete error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
