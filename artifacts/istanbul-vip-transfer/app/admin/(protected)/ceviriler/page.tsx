/**
 * /admin/ceviriler — Translation jobs management page.
 * Lists all translation jobs with filters and workflow actions.
 */
import type { Metadata } from 'next';
import { db } from '@/db';
import { contentTranslations, content, languages } from '@/db/schema';
import { desc, asc, eq, sql } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import CevirilerClient from './_CevirilerClient';

export const metadata: Metadata = { title: 'Çeviriler | Admin', robots: { index: false } };

export default async function CevirilerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; lang?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  let jobs: Array<{
    id: string;
    entityType: string;
    entityId: string;
    targetLanguageCode: string;
    status: string;
    title: string | null;
    isAiGenerated: boolean;
    updatedAt: Date;
    approvedAt: Date | null;
    publishedAt: Date | null;
    sourceTitle: string;
    sourceSlug: string;
    sourceStatus: string;
  }> = [];
  let total = 0;
  let dbError = false;
  let langs: (typeof languages.$inferSelect)[] = [];

  try {
    const { count: drizzleCount } = await import('drizzle-orm');
    const [langRows, [totalRow]] = await Promise.all([
      db.select().from(languages).where(eq(languages.isEnabled, true)).orderBy(asc(languages.displayOrder)),
      db.select({ count: drizzleCount() }).from(contentTranslations),
    ]);
    langs = langRows;
    total = Number(totalRow?.count ?? 0);
  } catch {
    // ignore
  }

  try {
    const rows = await db
      .select({
        id: contentTranslations.id,
        entityType: contentTranslations.entityType,
        entityId: contentTranslations.entityId,
        targetLanguageCode: contentTranslations.targetLanguageCode,
        status: contentTranslations.status,
        title: contentTranslations.title,
        isAiGenerated: contentTranslations.isAiGenerated,
        updatedAt: contentTranslations.updatedAt,
        approvedAt: contentTranslations.approvedAt,
        publishedAt: contentTranslations.publishedAt,
        sourceTitle: content.title,
        sourceSlug: content.slug,
        sourceStatus: content.status,
      })
      .from(contentTranslations)
      .innerJoin(content, sql`${contentTranslations.entityId}::uuid = ${content.id}`)
      .orderBy(desc(contentTranslations.updatedAt))
      .limit(limit)
      .offset(offset);

    jobs = rows.map((r) => ({
      ...r,
      status: r.status as string,
    }));
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Çeviriler"
        description="İçerik çevirilerini yönetin, onaylayın ve yayınlayın"
      />
      {dbError ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası. Migration çalıştırıldı mı?
        </p>
      ) : (
        <CevirilerClient jobs={jobs} langs={langs} page={page} total={total} limit={limit} />
      )}
    </div>
  );
}
