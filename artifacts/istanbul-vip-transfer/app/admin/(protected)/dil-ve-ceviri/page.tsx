/**
 * /admin/dil-ve-ceviri — Unified language & translation management page.
 *
 * Merges the old /admin/diller and /admin/ceviriler modules into a single
 * five-tab interface: Genel Bakış · Diller · Çeviri İşleri · İçerik Çevirileri · Ayarlar.
 */
import type { Metadata } from 'next';
import { db } from '@/db';
import {
  languages,
  contentTranslations,
  content,
  faqs,
  vehicles,
  navigationItems,
} from '@/db/schema';
import { asc, desc, sql, eq, and, count as drizzleCount } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import DilVeCeviriClient from './_DilVeCeviriClient';

export const metadata: Metadata = {
  title: 'Dil ve Çeviri Yönetimi | Admin',
  robots: { index: false },
};

export type DbLang = typeof languages.$inferSelect;

export type LangTranslationStats = Record<
  string,
  { draft: number; published: number; review: number; approved: number }
>;

export type CoverageStats = Record<string, { published: number; total: number }>;

export type EntitySources = {
  content:      Array<{ id: string; title: string; slug: string }>;
  service_page: Array<{ id: string; title: string; slug: string }>;
  blog:         Array<{ id: string; title: string; slug: string }>;
  faq:          Array<{ id: string; title: string; slug: string }>;
  vehicle:      Array<{ id: string; title: string; slug: string }>;
  navigation:   Array<{ id: string; title: string; slug: string }>;
};

export type Job = {
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
};

export default async function DilVeCeviriPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; entityType?: string; lang?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = sp.tab ?? 'genel-bakis';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const entityTypeFilter = sp.entityType ?? '';
  const langFilter = sp.lang ?? '';
  const limit = 30;
  const offset = (page - 1) * limit;

  // ── Language list + per-language translation stats ─────────────────────
  let langs: (typeof languages.$inferSelect)[] = [];
  const stats: LangTranslationStats = {};
  let dbError = false;

  try {
    const [langRows, statRows] = await Promise.all([
      db.select().from(languages).orderBy(desc(languages.isEnabled), asc(languages.displayOrder)),
      db
        .select({
          lang: contentTranslations.targetLanguageCode,
          draft:     sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} IN ('QUEUED','TRANSLATING','DRAFT'))`,
          review:    sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} IN ('REVIEW'))`,
          approved:  sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} IN ('APPROVED','SCHEDULED'))`,
          published: sql<number>`count(*) FILTER (WHERE ${contentTranslations.status} = 'PUBLISHED')`,
        })
        .from(contentTranslations)
        .groupBy(contentTranslations.targetLanguageCode),
    ]);
    langs = langRows;
    for (const r of statRows) {
      stats[r.lang] = {
        draft:     Number(r.draft),
        review:    Number(r.review),
        approved:  Number(r.approved),
        published: Number(r.published),
      };
    }
  } catch {
    dbError = true;
  }

  // ── Coverage stats (for Genel Bakış tab) ──────────────────────────────
  const coverage: CoverageStats = {};
  try {
    const [totalRow] = await db
      .select({ count: drizzleCount() })
      .from(content)
      .where(eq(content.status, 'PUBLISHED'));
    const totalContent = Number(totalRow?.count ?? 0);

    for (const lang of langs.filter((l) => l.code !== 'tr' && l.isEnabled)) {
      const [pubRow] = await db
        .select({ count: drizzleCount() })
        .from(contentTranslations)
        .where(
          and(
            eq(contentTranslations.targetLanguageCode, lang.code),
            eq(contentTranslations.status, 'PUBLISHED'),
          ),
        );
      coverage[lang.code] = {
        published: Number(pubRow?.count ?? 0),
        total: totalContent,
      };
    }
  } catch { /* ignore */ }

  // ── Entity sources (for Çeviri İşleri toolbar) ─────────────────────────
  let entitySources: EntitySources = {
    content: [], service_page: [], blog: [], faq: [], vehicle: [], navigation: [],
  };
  try {
    const [contentSrcs, serviceSrcs, blogSrcs, faqSrcs, vehicleSrcs, navSrcs] = await Promise.all([
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content).where(eq(content.contentType, 'PAGE')).orderBy(asc(content.title)),
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content).where(eq(content.contentType, 'SERVICE')).orderBy(asc(content.title)),
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content).where(eq(content.contentType, 'BLOG_POST')).orderBy(asc(content.title)),
      db.select({ id: faqs.id, title: faqs.question, slug: sql<string>`''::text`.as('faq_slug') })
        .from(faqs).orderBy(asc(faqs.sortOrder)),
      db.select({ id: vehicles.id, title: vehicles.name, slug: vehicles.slug })
        .from(vehicles).orderBy(asc(vehicles.displayOrder)),
      db.select({ id: navigationItems.id, title: navigationItems.label, slug: navigationItems.href })
        .from(navigationItems).orderBy(asc(navigationItems.sortOrder)),
    ]);
    entitySources = {
      content:      contentSrcs,
      service_page: serviceSrcs,
      blog:         blogSrcs,
      faq:          faqSrcs.map((r) => ({ id: r.id, title: r.title, slug: '' })),
      vehicle:      vehicleSrcs,
      navigation:   navSrcs,
    };
  } catch { /* ignore */ }

  // ── Translation jobs (for İçerik Çevirileri tab) ───────────────────────
  let jobs: Job[] = [];
  let total = 0;
  try {
    type FilterMode = 'page' | 'blog' | 'direct';
    const filterMode: FilterMode =
      entityTypeFilter === 'page' ? 'page' : entityTypeFilter === 'blog' ? 'blog' : 'direct';
    const directEntityType =
      filterMode === 'page' || filterMode === 'blog' ? 'content' : entityTypeFilter;

    const whereConditions = [];
    if (filterMode === 'page') {
      whereConditions.push(eq(contentTranslations.entityType, 'content'));
      whereConditions.push(eq(content.contentType, 'PAGE'));
    } else if (filterMode === 'blog') {
      whereConditions.push(eq(contentTranslations.entityType, 'content'));
      whereConditions.push(eq(content.contentType, 'BLOG_POST'));
    } else if (directEntityType) {
      whereConditions.push(eq(contentTranslations.entityType, directEntityType));
    }
    if (langFilter) {
      whereConditions.push(eq(contentTranslations.targetLanguageCode, langFilter));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    if (filterMode === 'page' || filterMode === 'blog') {
      const contentTypeHint = filterMode === 'page' ? 'PAGE' : 'BLOG_POST';
      const q = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      const cond = q ?? and(
        eq(contentTranslations.entityType, 'content'),
        eq(content.contentType, contentTypeHint),
      );
      const [totalRow] = await db
        .select({ count: drizzleCount() })
        .from(contentTranslations)
        .innerJoin(
          content,
          and(
            eq(contentTranslations.entityType, 'content'),
            sql`${contentTranslations.entityId}::uuid = ${content.id}`,
            eq(content.contentType, contentTypeHint),
          ),
        )
        .where(langFilter ? eq(contentTranslations.targetLanguageCode, langFilter) : undefined);
      void cond;
      total = Number(totalRow?.count ?? 0);
    } else {
      const [totalRow] = await db
        .select({ count: drizzleCount() })
        .from(contentTranslations)
        .leftJoin(content, sql`${contentTranslations.entityType} IN ('content','service_page') AND ${contentTranslations.entityId}::uuid = ${content.id}`)
        .where(whereClause);
      total = Number(totalRow?.count ?? 0);
    }

    const rows = await db
      .select({
        id:                 contentTranslations.id,
        entityType:         contentTranslations.entityType,
        entityId:           contentTranslations.entityId,
        targetLanguageCode: contentTranslations.targetLanguageCode,
        status:             contentTranslations.status,
        title:              contentTranslations.title,
        isAiGenerated:      contentTranslations.isAiGenerated,
        updatedAt:          contentTranslations.updatedAt,
        approvedAt:         contentTranslations.approvedAt,
        publishedAt:        contentTranslations.publishedAt,
        sourceTitle:  sql<string>`COALESCE(${content.title}, ${faqs.question}, ${vehicles.name}, ${navigationItems.label}, '')`.as('source_title'),
        sourceSlug:   sql<string>`COALESCE(${content.slug}, ${vehicles.slug}, ${navigationItems.href}, '')`.as('source_slug'),
        sourceStatus: sql<string>`COALESCE(${content.status}::text, 'active')`.as('source_status'),
      })
      .from(contentTranslations)
      .leftJoin(content,          sql`${contentTranslations.entityType} IN ('content','service_page') AND ${contentTranslations.entityId}::uuid = ${content.id}`)
      .leftJoin(faqs,             sql`${contentTranslations.entityType} = 'faq' AND ${contentTranslations.entityId}::uuid = ${faqs.id}`)
      .leftJoin(vehicles,         sql`${contentTranslations.entityType} = 'vehicle' AND ${contentTranslations.entityId}::uuid = ${vehicles.id}`)
      .leftJoin(navigationItems,  sql`${contentTranslations.entityType} = 'navigation' AND ${contentTranslations.entityId}::uuid = ${navigationItems.id}`)
      .where(whereClause)
      .orderBy(desc(contentTranslations.updatedAt))
      .limit(limit)
      .offset(offset);

    jobs = rows.map((r) => ({ ...r, status: r.status as string }));
  } catch (err) {
    console.error('DilVeCeviri jobs query error:', err);
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Dil ve Çeviri Yönetimi"
        description="Dil kataloğunu, çeviri işlerini ve yayın durumunu tek yerden yönetin"
      />
      {dbError ? (
        <p style={{ color: '#B91C1C', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası. Migration çalıştırıldı mı?
        </p>
      ) : (
        <DilVeCeviriClient
          langs={langs}
          stats={stats}
          coverage={coverage}
          jobs={jobs}
          total={total}
          page={page}
          limit={limit}
          entitySources={entitySources}
          entityTypeFilter={entityTypeFilter}
          langFilter={langFilter}
          initialTab={activeTab}
        />
      )}
    </div>
  );
}
