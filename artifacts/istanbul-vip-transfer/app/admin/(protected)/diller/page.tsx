/**
 * /admin/diller — Language catalog management page.
 * Full catalog with search, filters, pagination, enable/disable + publish actions.
 */
import type { Metadata } from 'next';
import { db } from '@/db';
import { languages, contentTranslations } from '@/db/schema';
import { asc, sql } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import DillerClient from './_DillerClient';

export const metadata: Metadata = { title: 'Dil Yönetimi | Admin', robots: { index: false } };

export type LangTranslationStats = Record<string, { draft: number; published: number }>;

export default async function DillerPage() {
  let langs: (typeof languages.$inferSelect)[] = [];
  const stats: LangTranslationStats = {};
  let dbError = false;

  try {
    const [langRows, statRows] = await Promise.all([
      db.select().from(languages).orderBy(asc(languages.displayOrder)),
      db
        .select({
          lang: contentTranslations.targetLanguageCode,
          draft: sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} IN ('QUEUED','TRANSLATING','DRAFT','REVIEW','APPROVED','SCHEDULED'))`,
          published: sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} = 'PUBLISHED')`,
        })
        .from(contentTranslations)
        .groupBy(contentTranslations.targetLanguageCode),
    ]);
    langs = langRows;
    for (const r of statRows) {
      stats[r.lang] = { draft: Number(r.draft), published: Number(r.published) };
    }
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Dil Yönetimi"
        description="Dil kataloğunu, kamu görünürlüğünü ve çeviri desteğini yönetin"
      />
      {dbError ? (
        <p style={{ color: '#B91C1C', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası. Migration çalıştırıldı mı?
        </p>
      ) : (
        <DillerClient langs={langs} stats={stats} />
      )}
    </div>
  );
}
