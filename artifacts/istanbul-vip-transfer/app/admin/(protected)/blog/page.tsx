import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/db';
import { content, contentTranslations } from '@/db/schema';
import { eq, desc, count, inArray } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import ContentList from '../../_components/ContentList';
import {
  computeBlogHealthIssues,
  getKnownBlogSlugs,
  getTranslationLocales,
  type BlogSourceRow,
  type BlogTranslationRow,
  type BlogHealthItem,
} from '@/lib/blog-health';

export const metadata: Metadata = { title: 'Blog | Admin', robots: { index: false } };

const ISSUE_LABELS: Record<string, string> = {
  missing_source_record:    'Veritabanında kaynak kayıt yok',
  missing_translation:      'Çeviri eksik (bazı diller için)',
  translation_not_published: 'Çeviri yayında değil',
};

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let items: (typeof content.$inferSelect)[] = [];
  let total = 0;
  let dbError = false;
  let healthIssues: BlogHealthItem[] = [];

  try {
    const [rows, totalRows] = await Promise.all([
      db.select().from(content).where(eq(content.contentType, 'BLOG_POST')).orderBy(desc(content.updatedAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(content).where(eq(content.contentType, 'BLOG_POST')),
    ]);
    items = rows;
    total = totalRows[0]?.count ?? 0;

    // Health check: cross-reference known slugs against source records + translations
    const allSourceRows = await db
      .select({ id: content.id, slug: content.slug, title: content.title })
      .from(content)
      .where(eq(content.contentType, 'BLOG_POST'));

    const sourceRows: BlogSourceRow[] = allSourceRows.map(r => ({
      id: r.id, slug: r.slug, title: r.title,
    }));

    const entityIds = sourceRows.map(r => r.id);
    const rawTranslations = entityIds.length > 0
      ? await db
          .select({
            entityId:           contentTranslations.entityId,
            targetLanguageCode: contentTranslations.targetLanguageCode,
            status:             contentTranslations.status,
          })
          .from(contentTranslations)
          .where(inArray(contentTranslations.entityId, entityIds))
      : [];

    const translationRows: BlogTranslationRow[] = rawTranslations.map(r => ({
      entityId:           r.entityId!,
      targetLanguageCode: r.targetLanguageCode,
      status:             r.status,
    }));

    healthIssues = computeBlogHealthIssues(
      getKnownBlogSlugs(),
      sourceRows,
      translationRows,
      getTranslationLocales(),
    );
  } catch { dbError = true; }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Blog"
        description="Blog yazılarını yönetin"
        action={<Link href="/admin/blog/yeni" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}><Plus size={15} /> Yeni Yazı</Link>}
      />

      {/* ── Health warning banner ──────────────────────────────────────────── */}
      {healthIssues.length > 0 && (
        <div style={{
          marginBottom: '20px', padding: '14px 18px',
          background: '#FFF7ED', border: '1px solid #FBBF24',
          borderRadius: '10px', fontFamily: 'Inter, sans-serif',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
            ⚠️ {healthIssues.length} blog yazısında sorun tespit edildi
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {healthIssues.map(h => (
              <li key={h.slug} style={{ fontSize: '12px', color: '#B45309', marginBottom: '4px' }}>
                <strong>{h.title ?? h.slug}</strong>{h.title ? ` (${h.slug})` : ''} —{' '}
                {h.issues.map(code => ISSUE_LABELS[code] ?? code).join(', ')}
                {h.translationDetails.length > 0 && (
                  <span style={{ marginLeft: '6px', color: '#92400E' }}>
                    [{h.translationDetails.map(d => `${d.locale}:${d.problem}`).join(', ')}]
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#92400E' }}>
            Eksik veya yayında olmayan çeviriler nedeniyle localized sayfalar (/en/blog/…, /de/blog/…)
            ziyaretçilere 404 hatası gösterebilir. İlgili blog yazısının çevirilerini kontrol edin.
          </p>
        </div>
      )}

      {dbError ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Veritabanı bağlantı hatası.</p>
      ) : (
        <ContentList items={items} baseUrl="/admin/blog" page={page} total={total} limit={limit} />
      )}
    </div>
  );
}
