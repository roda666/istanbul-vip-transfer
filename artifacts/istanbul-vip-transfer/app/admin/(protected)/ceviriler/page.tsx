/**
 * /admin/ceviriler — Translation jobs management page.
 * Lists all translation jobs with filters and workflow actions.
 * Supports entity types: content (PAGE), blog (BLOG_POST), service_page, faq, vehicle, navigation.
 */
import type { Metadata } from 'next';
import { db } from '@/db';
import { contentTranslations, content, languages, faqs, vehicles, navigationItems } from '@/db/schema';
import { desc, asc, sql, eq, and, count as drizzleCount } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import CevirilerClient from './_CevirilerClient';

export const metadata: Metadata = { title: 'Çeviriler | Admin', robots: { index: false } };

export type EntitySources = {
  content: Array<{ id: string; title: string; slug: string }>;
  service_page: Array<{ id: string; title: string; slug: string }>;
  blog: Array<{ id: string; title: string; slug: string }>;
  faq: Array<{ id: string; title: string; slug: string }>;
  vehicle: Array<{ id: string; title: string; slug: string }>;
  navigation: Array<{ id: string; title: string; slug: string }>;
};

export default async function CevirilerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  // 'page' | 'blog' | 'service_page' | 'faq' | 'vehicle' | 'navigation' | ''
  const entityTypeFilter = sp.entityType ?? '';
  const limit = 30;
  const offset = (page - 1) * limit;

  // Build drizzle WHERE conditions for both count and list queries
  // 'page' → entityType='content' + content.contentType='PAGE'
  // 'blog' → entityType='content' + content.contentType='BLOG_POST'
  // others → entityType=value
  type FilterMode = 'page' | 'blog' | 'direct';
  const filterMode: FilterMode =
    entityTypeFilter === 'page' ? 'page'
    : entityTypeFilter === 'blog' ? 'blog'
    : 'direct';
  const directEntityType =
    filterMode === 'page' ? 'content'
    : filterMode === 'blog' ? 'content'
    : entityTypeFilter; // '' | 'service_page' | 'faq' | 'vehicle' | 'navigation' | 'content'

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
  let entitySources: EntitySources = {
    content: [],
    service_page: [],
    blog: [],
    faq: [],
    vehicle: [],
    navigation: [],
  };

  // Fetch languages independently so a broken source query can't leave langs empty.
  try {
    langs = await db.select().from(languages).orderBy(asc(languages.displayOrder));
  } catch {
    // ignore — langNameByCode will fall back to raw codes
  }

  try {
    const [
      contentSrcs,
      serviceSrcs,
      blogSrcs,
      faqSrcs,
      vehicleSrcs,
      navSrcs,
    ] = await Promise.all([
      // Static pages (PAGE)
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content)
        .where(eq(content.contentType, 'PAGE'))
        .orderBy(asc(content.title)),
      // Service pages (SERVICE)
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content)
        .where(eq(content.contentType, 'SERVICE'))
        .orderBy(asc(content.title)),
      // Blog posts (BLOG_POST)
      db.select({ id: content.id, title: content.title, slug: content.slug })
        .from(content)
        .where(eq(content.contentType, 'BLOG_POST'))
        .orderBy(asc(content.title)),
      // FAQs
      db.select({ id: faqs.id, title: faqs.question, slug: sql<string>`''::text`.as('faq_slug') })
        .from(faqs)
        .orderBy(asc(faqs.sortOrder)),
      // Vehicles
      db.select({ id: vehicles.id, title: vehicles.name, slug: vehicles.slug })
        .from(vehicles)
        .orderBy(asc(vehicles.displayOrder)),
      // Navigation items
      db.select({ id: navigationItems.id, title: navigationItems.label, slug: navigationItems.href })
        .from(navigationItems)
        .orderBy(asc(navigationItems.sortOrder)),
    ]);

    entitySources = {
      content: contentSrcs,
      service_page: serviceSrcs,
      blog: blogSrcs,
      faq: faqSrcs.map((r) => ({ id: r.id, title: r.title, slug: '' })),
      vehicle: vehicleSrcs,
      navigation: navSrcs,
    };
  } catch {
    // ignore — will show DB error below
  }

  try {
    // ── Count query (entity-type aware) ──────────────────────────────────
    if (filterMode === 'page' || filterMode === 'blog') {
      const contentTypeHint = filterMode === 'page' ? 'PAGE' : 'BLOG_POST';
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
        );
      total = Number(totalRow?.count ?? 0);
    } else {
      const [totalRow] = await db
        .select({ count: drizzleCount() })
        .from(contentTranslations)
        .where(directEntityType ? eq(contentTranslations.entityType, directEntityType) : undefined);
      total = Number(totalRow?.count ?? 0);
    }

    // ── Jobs query — multi-table LEFT JOIN ────────────────────────────────
    // Handles all entity types in one query.
    // content/service_page → LEFT JOIN content
    // faq                  → LEFT JOIN faqs
    // vehicle              → LEFT JOIN vehicles
    // navigation           → LEFT JOIN navigation_items
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
        sourceTitle: sql<string>`COALESCE(${content.title}, ${faqs.question}, ${vehicles.name}, ${navigationItems.label}, '')`.as('source_title'),
        sourceSlug: sql<string>`COALESCE(${content.slug}, ${vehicles.slug}, ${navigationItems.href}, '')`.as('source_slug'),
        sourceStatus: sql<string>`COALESCE(${content.status}::text, 'active')`.as('source_status'),
      })
      .from(contentTranslations)
      .leftJoin(
        content,
        sql`${contentTranslations.entityType} IN ('content', 'service_page') AND ${contentTranslations.entityId}::uuid = ${content.id}`,
      )
      .leftJoin(
        faqs,
        sql`${contentTranslations.entityType} = 'faq' AND ${contentTranslations.entityId}::uuid = ${faqs.id}`,
      )
      .leftJoin(
        vehicles,
        sql`${contentTranslations.entityType} = 'vehicle' AND ${contentTranslations.entityId}::uuid = ${vehicles.id}`,
      )
      .leftJoin(
        navigationItems,
        sql`${contentTranslations.entityType} = 'navigation' AND ${contentTranslations.entityId}::uuid = ${navigationItems.id}`,
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(contentTranslations.updatedAt))
      .limit(limit)
      .offset(offset);

    jobs = rows.map((r) => ({ ...r, status: r.status as string }));
  } catch (err) {
    console.error('Ceviriler query error:', err);
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
        <CevirilerClient
          jobs={jobs}
          langs={langs}
          entitySources={entitySources}
          page={page}
          total={total}
          limit={limit}
          entityTypeFilter={entityTypeFilter}
        />
      )}
    </div>
  );
}
