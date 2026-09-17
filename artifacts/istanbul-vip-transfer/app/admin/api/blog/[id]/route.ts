/**
 * Dedicated Blog Post CMS Admin API
 *
 * GET  /admin/api/blog/[id]                           — full record + translations + revisions
 * PUT  /admin/api/blog/[id]                           — save blog fields + trigger OUTDATED on translations
 * POST /admin/api/blog/[id]  { action, locale? }
 *   Translation actions: approve | publish | unpublish | retranslate
 *   Source actions:      publishSource | unpublishSource | archiveSource | scheduleSource | ideaToResearch | toDraft | toReview | toApprove
 * DELETE /admin/api/blog/[id]                         — safe, Blog-only permanent delete
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getBlogAdminRecord, BLOG_ENTITY_TYPE, invalidatePublicBlogCache } from '@/lib/blog-cms';
import { SITE } from '@/lib/site-config';
import {
  computeCustomerContentSourceHash,
  enqueueCustomerContentTranslations,
} from '@/lib/customer-content-translation';
import 'server-only';

type Params = { params: Promise<{ id: string }> };

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getBlogContent(id: string) {
  const { db }      = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), eq(content.contentType, 'BLOG_POST')))
    .limit(1);
  return row ?? null;
}

async function getTranslation(contentId: string, locale: string) {
  const { db }                  = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { eq, and }             = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(contentTranslations)
    .where(and(
      eq(contentTranslations.entityType,         BLOG_ENTITY_TYPE),
      eq(contentTranslations.entityId,           contentId),
      eq(contentTranslations.targetLanguageCode, locale),
    ))
    .limit(1);
  return row ?? null;
}

async function writeAuditLog(opts: {
  contentId: string;
  action: string;
  locale?: string | null;
  adminUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const { db }        = await import('@/db');
    const { auditLogs } = await import('@/db/schema');
    await db.insert(auditLogs).values({
      entityType:  'blog_post',
      entityId:    opts.contentId,
      action:      opts.action,
      adminUserId: opts.adminUserId ?? null,
      metadata:    { locale: opts.locale ?? null, ...opts.details },
      createdAt:   new Date(),
    } as never);
  } catch { /* never break primary op */ }
}

async function saveRevision(
  contentId: string,
  snapshot: Record<string, unknown>,
  changedBy: string | null,
) {
  try {
    const { db }             = await import('@/db');
    const { blogRevisions }  = await import('@/db/schema');
    const { eq }             = await import('drizzle-orm');

    // Keep only 20 most recent — prune oldest first
    const existing = await db
      .select({ id: blogRevisions.id })
      .from(blogRevisions)
      .where(eq(blogRevisions.contentId, contentId))
      .orderBy((t: typeof blogRevisions) => (t as typeof blogRevisions).createdAt)
      .limit(50);

    if (existing.length >= 20) {
      const toDelete = existing.slice(0, existing.length - 19).map(r => r.id);
      const { inArray } = await import('drizzle-orm');
      await db.delete(blogRevisions).where(inArray(blogRevisions.id, toDelete));
    }

    await db.insert(blogRevisions).values({
      contentId,
      snapshot,
      changedBy,
      createdAt: new Date(),
    } as never);
  } catch { /* revision failure must not break save */ }
}

/** Compute a simple hash of translatable blog fields to detect source changes. */
function computeBlogSourceHash(body: string, title: string, excerpt?: string | null): string {
  return computeCustomerContentSourceHash({ title, excerpt: excerpt ?? null, body });
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const record = await getBlogAdminRecord(id);
    return NextResponse.json({ record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'Not found') return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
    return NextResponse.json({ error: 'DB hatası.' }, { status: 503 });
  }
}

// ── PUT (save blog post) ────────────────────────────────────────────────────────

const putSchema = z.object({
  title:          z.string().min(1).max(300),
  slug:           z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir.'),
  excerpt:        z.string().max(1000).nullable().optional(),
  body:           z.string().max(200_000),
  heroImage:      z.string().max(500).nullable().optional(),
  heroImageAlt:   z.string().max(300).nullable().optional(),
  ogImage:        z.string().max(500).nullable().optional(),
  category:       z.string().max(100).nullable().optional(),
  author:         z.string().max(200).nullable().optional(),
  showAuthor:     z.boolean().optional(),
  tags:           z.array(z.string().max(80)).max(20).optional(),
  readTimeMinutes: z.number().int().min(1).max(120).nullable().optional(),
  ogTitle:        z.string().max(200).nullable().optional(),
  ogDescription:  z.string().max(400).nullable().optional(),
  seoTitle:       z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  canonicalUrl:   z.string().max(500).nullable().optional(),
  scheduledAt:    z.string().datetime({ offset: true }).nullable().optional(),
  /** When true, save to draftBody without touching live body. */
  saveAsDraft:    z.boolean().default(false),
  /** Status to set — validated against state machine below. */
  newStatus:      z.enum(['IDEA','DRAFT','RESEARCH','REVIEW','APPROVED','SCHEDULED','PUBLISHED','ARCHIVED']).optional(),
});

// Valid status transitions for a PUT (source record status changes)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  IDEA:      ['DRAFT', 'RESEARCH', 'ARCHIVED'],
  DRAFT:     ['IDEA', 'RESEARCH', 'ARCHIVED'],
  RESEARCH:  ['DRAFT', 'REVIEW', 'ARCHIVED'],
  REVIEW:    ['RESEARCH', 'APPROVED', 'DRAFT', 'ARCHIVED'],
  APPROVED:  ['REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  SCHEDULED: ['APPROVED', 'PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  OUTDATED:  ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  ARCHIVED:  ['DRAFT', 'IDEA'],
};

export async function PUT(req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>> | null = null;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const row = await getBlogContent(id);
  if (!row) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = putSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const data = parsed.data;
  const adminUserId = session?.adminId ?? null;

  // Validate status transition
  const currentStatus = row.status as string;
  const requestedStatus = data.newStatus ?? (data.saveAsDraft ? 'DRAFT' : undefined);

  if (requestedStatus && requestedStatus !== currentStatus) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(requestedStatus)) {
      return NextResponse.json(
        { error: `"${currentStatus}" durumundan "${requestedStatus}" durumuna geçiş geçersiz.` },
        { status: 409 }
      );
    }
  }

  const { db }              = await import('@/db');
  const { content, contentTranslations, siteSettings } = await import('@/db/schema');
  const { eq, inArray }     = await import('drizzle-orm');

  const now = new Date();
  const canonicalUrl = data.canonicalUrl ?? `${SITE.siteUrl}/blog/${data.slug ?? row.slug}`;
  const [{ approvalGateEnabled = true } = {}] = await db
    .select({ approvalGateEnabled: siteSettings.approvalGateEnabled })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);

  // Draft-of-published semantics
  const savingDraftOfPublished = data.saveAsDraft && row.status === 'PUBLISHED';
  const showAuthor = data.showAuthor ?? row.showAuthor ?? true;
  const sourceChanged = data.title !== row.title
    || data.slug !== row.slug
    || (data.excerpt ?? null) !== (row.excerpt ?? null)
    || data.body !== row.body
    || (data.seoTitle ?? null) !== (row.seoTitle ?? null)
    || (data.seoDescription ?? null) !== (row.seoDescription ?? null)
    || (data.heroImageAlt ?? null) !== (row.heroImageAlt ?? null)
    || (data.heroImage ?? null) !== (row.heroImage ?? null)
    || (data.ogImage ?? null) !== (row.ogImage ?? null)
    || (data.ogTitle ?? null) !== (row.ogTitle ?? null)
    || (data.ogDescription ?? null) !== (row.ogDescription ?? null)
    || (data.canonicalUrl ?? null) !== (row.canonicalUrl ?? null)
    || (data.category ?? null) !== (row.category ?? null)
    || (data.author ?? null) !== (row.author ?? null)
    || JSON.stringify(data.tags ?? []) !== JSON.stringify(row.tags ?? [])
    || (data.readTimeMinutes ?? null) !== (row.readTimeMinutes ?? null)
    || showAuthor !== row.showAuthor;
  const automaticPublicationRequested = !data.saveAsDraft
    && Boolean(data.title?.trim() && data.body?.trim())
    && sourceChanged
    && ['IDEA', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(requestedStatus ?? currentStatus);
  const atomicSourceSnapshot = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt ?? null,
    body: data.body,
    heroImage: data.heroImage ?? null,
    heroImageAlt: data.heroImageAlt ?? null,
    ogImage: data.ogImage ?? null,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    ogTitle: data.ogTitle ?? null,
    ogDescription: data.ogDescription ?? null,
    canonicalUrl,
    category: data.category ?? null,
    author: data.author ?? null,
    showAuthor,
    tags: data.tags ?? [],
    readTimeMinutes: data.readTimeMinutes ?? null,
    cta: row.cta,
    internalLinks: row.internalLinks,
    ...(automaticPublicationRequested && currentStatus === 'PUBLISHED'
      ? { baseHash: computeCustomerContentSourceHash({
          title: row.title, slug: row.slug, excerpt: row.excerpt ?? null, body: row.body,
          seoTitle: row.seoTitle, seoDescription: row.seoDescription,
          heroImageAlt: row.heroImageAlt, ogTitle: row.ogTitle, ogDescription: row.ogDescription,
          showAuthor: row.showAuthor,
          cta: row.cta, internalLinks: row.internalLinks,
        }) }
      : {}),
  };

  let updateFields: Record<string, unknown>;
  if (automaticPublicationRequested && currentStatus === 'PUBLISHED') {
    // Keep the last public Turkish payload live while the eight translations
    // are generated. The atomic finalizer promotes this snapshot only after
    // every task passes validation.
    updateFields = { draftBody: data.body, updatedAt: now };
  } else if (savingDraftOfPublished) {
    updateFields = {
      draftBody:  data.body,
      updatedAt:  now,
    };
  } else {
    const finalStatus = requestedStatus ?? currentStatus;

    // Guard: publishing requires non-empty title and body
    if (finalStatus === 'PUBLISHED') {
      if (!data.title?.trim() || !data.body?.trim()) {
        return NextResponse.json(
          { error: 'Yayımlanacak içeriğin başlık ve gövde alanları dolu olmalıdır.' },
          { status: 422 }
        );
      }
      const existingRow = row as Record<string, unknown>;
      if (approvalGateEnabled && !automaticPublicationRequested && (!existingRow.approvedAt || !existingRow.approvedBy)) {
        return NextResponse.json(
          { error: 'Yayınlamadan önce içerik onaylanmalıdır. Onay kapısı ayarlarda etkin.' },
          { status: 409 },
        );
      }
      // A saved edit and a publish request must never share an old approval.
      // Editors must save the edit, send it back through review, then publish
      // the unchanged approved revision in a separate operation.
      if (approvalGateEnabled && !automaticPublicationRequested && (
        (data.title ?? row.title) !== row.title ||
        (data.body ?? row.body) !== row.body ||
        (data.excerpt === undefined ? row.excerpt : data.excerpt) !== row.excerpt
      )) {
        return NextResponse.json(
          { error: 'Düzenlenen içerik önce yeniden incelemeye ve onaya gönderilmelidir.' },
          { status: 409 },
        );
      }
    }

    updateFields = {
      title:          data.title,
      slug:           data.slug,
      excerpt:        data.excerpt ?? null,
      body:           data.body,
      draftBody:      null,
      heroImage:      data.heroImage ?? null,
      heroImageAlt:   data.heroImageAlt ?? null,
      ogImage:        data.ogImage ?? null,
      category:       data.category ?? null,
      author:         data.author ?? null,
      showAuthor,
      tags:           data.tags ?? [],
      readTimeMinutes: data.readTimeMinutes ?? null,
      ogTitle:        data.ogTitle ?? null,
      ogDescription:  data.ogDescription ?? null,
      seoTitle:       data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      canonicalUrl,
      indexable:      true,
      isActive:       true,
      // A newly created IDEA becomes a durable draft once it has complete
      // Turkish content. The translation queue can then publish it atomically
      // without requiring the old approval transition.
      status:         finalStatus === 'IDEA' && !data.saveAsDraft && data.body.trim()
        ? 'DRAFT'
        : finalStatus,
      publishedAt:    finalStatus === 'PUBLISHED' ? (row.publishedAt ?? now) : row.publishedAt,
      scheduledAt:    data.scheduledAt ? new Date(data.scheduledAt) : (row.scheduledAt ?? null),
      updatedAt:      now,
    };
    // Preserve the approval invariant even when an editor uses the generic
    // save endpoint rather than a workflow button.
    if (
      approvalGateEnabled &&
      (currentStatus === 'APPROVED' || currentStatus === 'SCHEDULED') &&
      finalStatus !== 'PUBLISHED' &&
      (
        (data.title ?? row.title) !== row.title ||
        (data.body ?? row.body) !== row.body ||
        (data.excerpt === undefined ? row.excerpt : data.excerpt) !== row.excerpt
      )
    ) {
      updateFields.status = 'REVIEW';
      updateFields.approvedAt = null;
      updateFields.approvedBy = null;
      updateFields.scheduledAt = null;
    }

    // Approval attribution on publish (APPROVED → PUBLISHED)
    if (finalStatus === 'PUBLISHED') {
      const existingRow = row as Record<string, unknown>;
      // Never manufacture an approval while the gate is enabled.  That would
      // turn a direct PUT into an unreviewed publish path.
      if (!approvalGateEnabled) {
        updateFields.approvedAt = existingRow.approvedAt ?? now;
        updateFields.approvedBy = existingRow.approvedBy ?? adminUserId;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.update(content).set(updateFields as any).where(eq(content.id, id)));

  // Mark PUBLISHED translations OUTDATED when source body/title changes
  if (!savingDraftOfPublished && !(automaticPublicationRequested && currentStatus === 'PUBLISHED')) {
    const legacySrcHash = computeBlogSourceHash(data.body, data.title, data.excerpt);
    const txRows = await db
      .select({ id: contentTranslations.id, status: contentTranslations.status, sourceHash: contentTranslations.sourceHash })
      .from(contentTranslations)
      .where(eq(contentTranslations.entityId, id));

    const toOutdate = txRows
      .filter(tx => ['PUBLISHED', 'APPROVED'].includes(tx.status) && tx.sourceHash !== legacySrcHash)
      .map(tx => tx.id);

    if (toOutdate.length > 0) {
      await db
        .update(contentTranslations)
        .set({ status: 'OUTDATED', updatedAt: now } as never)
        .where(inArray(contentTranslations.id, toOutdate));
    }

    const customerVisibleSnapshot = atomicSourceSnapshot;
    const srcHash = computeCustomerContentSourceHash(customerVisibleSnapshot);
    const finalStatusForTranslation = requestedStatus ?? currentStatus;
    // Blog source saves are durable publication requests, not an approval
    // workflow. The queue runner owns the provider call and the atomic
    // finalizer publishes Turkish + all eight locales together. A deliberate
    // saveAsDraft remains the sole opt-out for editors preparing unpublished
    // work; manual translation locks are still respected by the atomic runner.
    const autoPublishEligible = automaticPublicationRequested
      && ['IDEA', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(finalStatusForTranslation);
    if (autoPublishEligible) {
      await enqueueCustomerContentTranslations({
        entityType: 'content',
        entityId: id,
        sourceHash: srcHash,
        adminId: adminUserId,
        publishOnComplete: true,
        preservePublishedWhileRunning: true,
        sourceSnapshot: atomicSourceSnapshot,
      });
    }
  }

  // Save revision snapshot
  await saveRevision(
    id,
    {
      title:          data.title,
      slug:           data.slug,
      excerpt:        data.excerpt ?? null,
      body:           data.body?.slice(0, 5000), // cap snapshot size
      status:         requestedStatus ?? currentStatus,
      heroImage:      data.heroImage ?? null,
      heroImageAlt:   data.heroImageAlt ?? null,
      ogImage:        data.ogImage ?? null,
      author:         data.author ?? null,
      showAuthor,
      category:       data.category ?? null,
      tags:           data.tags ?? [],
      readTimeMinutes: data.readTimeMinutes ?? null,
      ogTitle:        data.ogTitle ?? null,
      ogDescription:  data.ogDescription ?? null,
      seoTitle:       data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      canonicalUrl,
      savedAt:        now.toISOString(),
      saveAsDraft:    data.saveAsDraft,
    },
    adminUserId,
  );

  await writeAuditLog({
    contentId:   id,
    action:      savingDraftOfPublished ? 'save_draft_pending' : (data.saveAsDraft ? 'save_draft' : 'save'),
    adminUserId,
    details:     { title: data.title, newStatus: requestedStatus },
  });

  await invalidatePublicBlogCache({ id, slug: data.slug, previousSlug: row.slug });
  const record = await getBlogAdminRecord(id);
  return NextResponse.json({ record });
}

// ── POST (workflow actions) ────────────────────────────────────────────────────

const actionSchema = z.object({
  action: z.enum([
    // Translation content save
    'saveTx',
    // Translation workflow
    'approve', 'publish', 'unpublish', 'retranslate',
    // Source actions
    'publishSource', 'publishAllLanguages', 'unpublishSource', 'archiveSource', 'scheduleSource',
    'toIdea', 'toResearch', 'toDraft', 'toReview', 'toApprove',
    // Revision revert
    'revertToRevision',
  ]),
  locale:     z.string().min(2).max(10).optional(),
  revisionId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>> | null = null;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const row = await getBlogContent(id);
  if (!row) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz eylem.' }, { status: 422 });
  }

  const { action, locale, revisionId, scheduledAt } = parsed.data;
  const adminUserId = session?.adminId ?? null;
  const { db }   = await import('@/db');
  const { content, contentTranslations, blogRevisions, siteSettings } = await import('@/db/schema');
  const { eq }   = await import('drizzle-orm');
  const now      = new Date();
  const [settings] = await db.select({ approvalGateEnabled: siteSettings.approvalGateEnabled })
    .from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  const approvalGateEnabled = settings?.approvalGateEnabled ?? true;

  if (action === 'publishAllLanguages') {
    if (!session?.capabilities.content.canManage) {
      return NextResponse.json({ error: 'Blog yayımlama yetkisi gerekli.' }, { status: 403 });
    }
    if (!['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(row.status)) {
      return NextResponse.json(
        { error: `"${row.status}" durumundaki Blog yazısı toplu yayımlanamaz.` },
        { status: 409 },
      );
    }
    if (!row.title?.trim() || !row.body?.trim()) {
      return NextResponse.json(
        { error: 'Yayımlanacak içeriğin başlık ve gövde alanları dolu olmalıdır.' },
        { status: 422 },
      );
    }
    const { computeBlogAtomicSourceHash } = await import('@/lib/blog-atomic-publish');
    const queued = await enqueueCustomerContentTranslations({
      entityType: 'content',
      entityId: id,
      sourceHash: computeBlogAtomicSourceHash(row),
      adminId: adminUserId,
      publishOnComplete: true,
      preservePublishedWhileRunning: true,
    });
    const { translationJobs, translationJobTasks } = await import('@/db/schema');
    const tasks = await db.select().from(translationJobTasks)
      .where(eq(translationJobTasks.jobId, queued.jobId));
    const [job] = await db.select().from(translationJobs)
      .where(eq(translationJobs.id, queued.jobId)).limit(1);
    await writeAuditLog({
      contentId: id,
      action: 'publish_all_languages_requested',
      adminUserId,
      details: { jobId: queued.jobId, created: queued.created },
    });
    return NextResponse.json({ job, tasks });
  }

  // ── Source status actions ─────────────────────────────────────────────────

  const sourceStatusMap: Record<string, string> = {
    toIdea:          'IDEA',
    toResearch:      'RESEARCH',
    toDraft:         'DRAFT',
    toReview:        'REVIEW',
    toApprove:       'APPROVED',
    publishSource:   'PUBLISHED',
    unpublishSource: 'DRAFT',
    archiveSource:   'ARCHIVED',
    scheduleSource:  'SCHEDULED',
  };

  if (action in sourceStatusMap) {
    const newStatus = sourceStatusMap[action];
    // Validate transition
    const currentStatus = row.status as string;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (newStatus !== currentStatus && !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `"${currentStatus}" durumundan "${newStatus}" durumuna geçiş geçersiz.` },
        { status: 409 }
      );
    }

    // Guard for publishSource: require non-empty title and body
    if (action === 'publishSource') {
      if (!row.title?.trim() || !row.body?.trim()) {
        return NextResponse.json(
          { error: 'Yayımlanacak içeriğin başlık ve gövde alanları dolu olmalıdır.' },
          { status: 422 }
        );
      }
      const existingRow = row as Record<string, unknown>;
      if (approvalGateEnabled && (!existingRow.approvedAt || !existingRow.approvedBy)) {
        return NextResponse.json(
          { error: 'Yayınlamadan önce içerik onaylanmalıdır. Onay kapısı ayarlarda etkin.' },
          { status: 409 },
        );
      }
    }

    const updateFields: Record<string, unknown> = {
      status:    newStatus,
      updatedAt: now,
    };
    // Approval metadata
    if (action === 'toApprove') {
      updateFields.approvedAt = now;
      updateFields.approvedBy = adminUserId;
    }
    if (newStatus === 'PUBLISHED') {
      updateFields.publishedAt  = row.publishedAt ?? now;
      if (!approvalGateEnabled) {
        updateFields.approvedAt = (row as Record<string, unknown>).approvedAt ?? now;
        updateFields.approvedBy = (row as Record<string, unknown>).approvedBy ?? adminUserId;
      }
    }
    if (newStatus === 'SCHEDULED' && scheduledAt) {
      updateFields.scheduledAt = new Date(scheduledAt);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.update(content).set(updateFields as any).where(eq(content.id, id)));
    await writeAuditLog({ contentId: id, action, adminUserId, details: { newStatus } });
    if (action === 'publishSource') {
      await enqueueCustomerContentTranslations({
        entityType: 'content',
        entityId: id,
        sourceHash: computeCustomerContentSourceHash({
          title: row.title, slug: row.slug, excerpt: row.excerpt, body: row.body,
          seoTitle: row.seoTitle, seoDescription: row.seoDescription,
          heroImageAlt: row.heroImageAlt, ogTitle: row.ogTitle, ogDescription: row.ogDescription,
          cta: row.cta, internalLinks: row.internalLinks,
        }),
        adminId: adminUserId,
      });
    }
    await invalidatePublicBlogCache({ id, slug: row.slug });
    const record = await getBlogAdminRecord(id);
    return NextResponse.json({ record });
  }

  // ── Revision revert ────────────────────────────────────────────────────────

  if (action === 'revertToRevision') {
    if (!revisionId) return NextResponse.json({ error: 'revisionId gerekli.' }, { status: 422 });

    const [rev] = await db
      .select()
      .from(blogRevisions)
      .where(eq(blogRevisions.id, revisionId))
      .limit(1);

    if (!rev || rev.contentId !== id) {
      return NextResponse.json({ error: 'Revizyon bulunamadı.' }, { status: 404 });
    }

    const snap = rev.snapshot as Record<string, unknown>;
    await (db.update(content).set({
      title:    (snap.title as string | undefined) ?? row.title,
      excerpt:  (snap.excerpt as string | null | undefined) ?? row.excerpt,
      draftBody: (snap.body as string | undefined) ?? row.draftBody,
      updatedAt: now,
    } as never).where(eq(content.id, id)));

    await writeAuditLog({ contentId: id, action: 'revert_revision', adminUserId, details: { revisionId } });
    await invalidatePublicBlogCache({ id, slug: row.slug });
    const record = await getBlogAdminRecord(id);
    return NextResponse.json({ record });
  }

  // ── Save translation content (manual edit) ────────────────────────────────

  if (action === 'saveTx') {
    if (!locale) return NextResponse.json({ error: 'locale gerekli.' }, { status: 422 });

    const saveTxSchema = z.object({
      title:           z.string().max(300).nullable().optional(),
      slug:            z.string().max(200).regex(/^[a-z0-9-]*$/).nullable().optional(),
      excerpt:         z.string().max(1000).nullable().optional(),
      body:            z.string().max(200_000).nullable().optional(),
      metaTitle:       z.string().max(200).nullable().optional(),
      metaDescription: z.string().max(400).nullable().optional(),
    }).passthrough();

    const txParsed = saveTxSchema.safeParse(rawBody);
    if (!txParsed.success) {
      return NextResponse.json({ error: 'Geçersiz çeviri verisi.' }, { status: 422 });
    }

    const txData = txParsed.data as {
      title?: string | null; slug?: string | null; excerpt?: string | null;
      body?: string | null; metaTitle?: string | null; metaDescription?: string | null;
    };

    const existing = await getTranslation(id, locale);
    // Record sourceHash so a subsequent source save won't spuriously mark this OUTDATED
    const currentSrcHash = computeBlogSourceHash(row.body ?? '', row.title, row.excerpt ?? '');
    const txNow = new Date();
    if (existing) {
      await db.update(contentTranslations).set({
        title:           txData.title ?? existing.title,
        slug:            txData.slug ?? existing.slug,
        excerpt:         txData.excerpt ?? existing.excerpt,
        body:            txData.body ?? existing.body,
        metaTitle:       txData.metaTitle ?? existing.metaTitle,
        metaDescription: txData.metaDescription ?? existing.metaDescription,
        status:          existing.status === 'NOT_STARTED' ? 'DRAFT' : existing.status,
        sourceHash:      currentSrcHash,
        updatedAt:       txNow,
      } as never).where(eq(contentTranslations.id, existing.id));
    } else {
      await db.insert(contentTranslations).values({
        entityType:         BLOG_ENTITY_TYPE,
        entityId:           id,
        targetLanguageCode: locale,
        status:             'DRAFT',
        title:              txData.title ?? null,
        slug:               txData.slug ?? null,
        excerpt:            txData.excerpt ?? null,
        body:               txData.body ?? null,
        metaTitle:          txData.metaTitle ?? null,
        metaDescription:    txData.metaDescription ?? null,
        sourceHash:         currentSrcHash,
        createdAt:          txNow,
        updatedAt:          txNow,
      } as never);
    }
    await writeAuditLog({ contentId: id, action: 'save_translation', locale, adminUserId });
    await invalidatePublicBlogCache({
      id,
      slug: row.slug,
      previousLocalizedSlugs: existing ? [{ locale, slug: existing.slug }] : undefined,
    });
    const record = await getBlogAdminRecord(id);
    return NextResponse.json({ record });
  }

  // ── Translation actions ────────────────────────────────────────────────────

  if (!locale) {
    return NextResponse.json({ error: 'locale gerekli.' }, { status: 422 });
  }

  const tx = await getTranslation(id, locale);

  if (action === 'retranslate') {
    // Stub — Task #123 (AI İçerik Merkezi) will wire the actual AI call.
    // For now, just reset to DRAFT so the admin can manually edit.
    if (tx) {
      await db
        .update(contentTranslations)
        .set({ status: 'DRAFT', sourceHash: null, updatedAt: now } as never)
        .where(eq(contentTranslations.id, tx.id));
    } else {
      await db.insert(contentTranslations).values({
        entityType:         BLOG_ENTITY_TYPE,
        entityId:           id,
        targetLanguageCode: locale,
        status:             'DRAFT',
        createdAt:          now,
        updatedAt:          now,
      } as never);
    }
    await writeAuditLog({ contentId: id, action: 'retranslate', locale, adminUserId });
    await invalidatePublicBlogCache({ id, slug: row.slug });
    const record = await getBlogAdminRecord(id);
    return NextResponse.json({ record });
  }

  if (!tx) {
    return NextResponse.json({ error: 'Çeviri bulunamadı.' }, { status: 404 });
  }

  if (action === 'approve') {
    if (tx.status === 'OUTDATED') {
      return NextResponse.json(
        { error: 'Güncelliğini yitirmiş çeviri onaylanamaz — önce "Yeniden Çevir" ile yenileyin.' },
        { status: 409 }
      );
    }
    if (!['DRAFT', 'REVIEW'].includes(tx.status)) {
      return NextResponse.json({ error: `"${tx.status}" durumundan onay yapılamaz.` }, { status: 409 });
    }
    // Record current source hash at approval time so the translation isn't spuriously
    // marked OUTDATED on the next source save when translatable content hasn't changed.
    const approveSrcHash = computeBlogSourceHash(row.body ?? '', row.title, row.excerpt ?? '');
    await db
      .update(contentTranslations)
      .set({ status: 'APPROVED', approvedAt: now, approvedBy: adminUserId, sourceHash: approveSrcHash, updatedAt: now } as never)
      .where(eq(contentTranslations.id, tx.id));
    await writeAuditLog({ contentId: id, action: 'approve_translation', locale, adminUserId });
  }

  else if (action === 'publish') {
    // Only APPROVED translations may be published — ensures content was
    // reviewed and titles/body are non-empty before going live.
    if (tx.status === 'OUTDATED') {
      return NextResponse.json(
        { error: 'Güncelliğini yitirmiş çeviri yayımlanamaz — önce &quot;Yeniden Çevir&quot; ile yenileyin.' },
        { status: 409 }
      );
    }
    if (tx.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Yayımlamak için önce çeviriyi onaylayın (mevcut durum: ${tx.status}). APPROVED durumuna geldikten sonra yayımlayabilirsiniz.` },
        { status: 409 }
      );
    }
    // Guard against empty content slipping through
    if (!tx.title?.trim() || !tx.body?.trim()) {
      return NextResponse.json(
        { error: 'Yayımlanacak çevirinin başlık ve içerik alanları dolu olmalıdır.' },
        { status: 422 }
      );
    }
    await db
      .update(contentTranslations)
      .set({ status: 'PUBLISHED', publishedAt: tx.publishedAt ?? now, approvedAt: tx.approvedAt ?? now, updatedAt: now } as never)
      .where(eq(contentTranslations.id, tx.id));
    await writeAuditLog({ contentId: id, action: 'publish_translation', locale, adminUserId });
  }

  else if (action === 'unpublish') {
    if (!['PUBLISHED', 'OUTDATED'].includes(tx.status)) {
      return NextResponse.json({ error: `"${tx.status}" durumundan yayımı kaldırılamaz.` }, { status: 409 });
    }
    await db
      .update(contentTranslations)
      .set({ status: 'DRAFT', updatedAt: now } as never)
      .where(eq(contentTranslations.id, tx.id));
    await writeAuditLog({ contentId: id, action: 'unpublish_translation', locale, adminUserId });
  }

  const record = await getBlogAdminRecord(id);
  await invalidatePublicBlogCache({ id, slug: row.slug });
  return NextResponse.json({ record });
}

// ── DELETE (safe Blog-only deletion) ──────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.capabilities.content.canManage) {
    return NextResponse.json({ error: 'Blog silme yetkisi gerekli.' }, { status: 403 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { auditLogs, content, contentTranslations, navigationItems } = await import('@/db/schema');
  const { and, eq, ne } = await import('drizzle-orm');

  try {
    const result = await db.transaction(async tx => {
      const [current] = await tx.select().from(content).where(and(
        eq(content.id, id),
        eq(content.contentType, 'BLOG_POST'),
      )).limit(1);
      if (!current) return { error: 'Blog yazısı bulunamadı.', status: 404 as const };
      if (['PUBLISHED', 'APPROVED', 'SCHEDULED'].includes(current.status)) {
        return {
          error: 'Yayındaki veya onaylanmış Blog yazısı silinemez. Önce yayından kaldırın ya da arşivleyin.',
          status: 409 as const,
          dependencies: [{ type: 'publication', label: 'Yayın durumu', count: 1 }],
        };
      }

      const publicHref = `/blog/${current.slug}`;
      const navRefs = await tx.select({ id: navigationItems.id }).from(navigationItems)
        .where(eq(navigationItems.href, publicHref));
      const contentRefs = await tx.select({ internalLinks: content.internalLinks }).from(content)
        .where(ne(content.id, id));
      const internalReferenceCount = contentRefs.reduce((count, item) => {
        const links = Array.isArray(item.internalLinks) ? item.internalLinks : [];
        return count + links.filter(link => link?.href === publicHref).length;
      }, 0);
      const referenceCount = navRefs.length + internalReferenceCount;
      if (referenceCount > 0) {
        return {
          error: 'Bu Blog yazısı menüde veya başka içeriklerin dahili bağlantılarında kullanılıyor. Önce bağlantıları kaldırın.',
          status: 409 as const,
          dependencies: [{ type: 'reference', label: 'Menü / dahili bağlantı', count: referenceCount }],
        };
      }

      await tx.delete(contentTranslations).where(and(
        eq(contentTranslations.entityType, BLOG_ENTITY_TYPE),
        eq(contentTranslations.entityId, id),
      ));
      const [deleted] = await tx.delete(content).where(and(
        eq(content.id, id),
        eq(content.contentType, 'BLOG_POST'),
      )).returning({ id: content.id, title: content.title, slug: content.slug });
      if (!deleted) return { error: 'Blog yazısı bulunamadı.', status: 404 as const };
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'DELETE',
        entityType: 'blog_post',
        entityId: deleted.id,
        metadata: { title: deleted.title, slug: deleted.slug },
      } as never);
      return { success: true as const, slug: deleted.slug };
    });
    if ('error' in result) return NextResponse.json(result, { status: result.status });
    await invalidatePublicBlogCache({ id, slug: result.slug });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blog delete error:', error);
    return NextResponse.json({ error: 'Blog yazısı silinemedi.' }, { status: 503 });
  }
}
