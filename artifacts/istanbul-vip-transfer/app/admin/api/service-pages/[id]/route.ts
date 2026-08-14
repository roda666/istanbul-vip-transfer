/**
 * Admin API for service page CMS.
 *
 * GET  /admin/api/service-pages/[id]                — full record with translations
 * PATCH /admin/api/service-pages/[id]               — save TR content + auto-translate targets
 * POST /admin/api/service-pages/[id]  { action, locale? }
 *   actions on translations:  approve | publish | unpublish | translate
 *   actions on source record: archiveSource | publishSource | unpublishSource | duplicate
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getServicePageAdminRecord, ENTITY_TYPE } from '@/lib/service-page-cms';
import {
  parseServicePageBody,
  extractTranslatableFields,
  computeTranslatableHash,
  applyTranslatedFields,
  isServicePageBody,
  type ServicePageBody,
} from '@/lib/service-page-types';
import { translateServicePageFields } from '@/lib/ai/translate-service-page';
import { SITE } from '@/lib/site-config';
import 'server-only';

type Params = { params: Promise<{ id: string }> };

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function getContent(id: string) {
  const { db }      = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), eq(content.contentType, 'SERVICE')))
    .limit(1);
  return row ?? null;
}

async function getTranslation(contentId: string, locale: string) {
  const { db }                 = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { eq, and }            = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(contentTranslations)
    .where(and(
      eq(contentTranslations.entityType,         ENTITY_TYPE),
      eq(contentTranslations.entityId,           contentId),
      eq(contentTranslations.targetLanguageCode, locale),
    ))
    .limit(1);
  return row ?? null;
}

async function getActiveTargetLocales(): Promise<string[]> {
  try {
    const { db }       = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { eq }       = await import('drizzle-orm');
    const rows = await db
      .select({ code: languages.code })
      .from(languages)
      .where(eq(languages.isEnabled, true));
    return rows.map(r => r.code).filter(c => c !== 'tr');
  } catch {
    const { NON_SOURCE_LOCALES } = await import('@/lib/i18n/locale-registry');
    return [...NON_SOURCE_LOCALES];
  }
}

/** Write an audit log entry to the shared audit_logs table. */
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
      entityType:   'service_page',
      entityId:     opts.contentId,
      action:       opts.action,
      adminUserId:  opts.adminUserId ?? null,
      metadata:     { locale: opts.locale ?? null, ...opts.details },
      createdAt:    new Date(),
    } as never);
  } catch {
    // Audit log failure must never break the primary operation
  }
}

// ── Auto-translate one locale ─────────────────────────────────────────────────

async function translateAndSave(
  contentId: string,
  srcBody: ServicePageBody,
  srcHash: string,
  locale: string,
): Promise<{ ok: boolean; error?: string }> {
  const { db }                = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { eq, and }           = await import('drizzle-orm');

  const existing = await getTranslation(contentId, locale);

  // Skip if manually locked
  if (existing?.isManuallyLocked) return { ok: true };
  // Skip if already translated from same source hash
  if (existing?.sourceHash === srcHash && existing.status !== 'FAILED') return { ok: true };

  const txBase = {
    entityType:         ENTITY_TYPE,
    entityId:           contentId,
    targetLanguageCode: locale,
    status:             'TRANSLATING',
    sourceHash:         srcHash,
    isAiGenerated:      true,
    isManuallyLocked:   false,
    failureReason:      null,
    updatedAt:          new Date(),
  } as const;

  if (existing) {
    await db
      .update(contentTranslations)
      .set(txBase)
      .where(eq(contentTranslations.id, existing.id));
  } else {
    await db.insert(contentTranslations).values({ ...txBase, createdAt: new Date() } as never);
  }

  const fields = extractTranslatableFields(srcBody);
  const result = await translateServicePageFields(fields, locale);

  if (!result.ok) {
    await db
      .update(contentTranslations)
      .set({ status: 'FAILED', failureReason: result.message ?? result.reason, updatedAt: new Date() })
      .where(and(
        eq(contentTranslations.entityType,         ENTITY_TYPE),
        eq(contentTranslations.entityId,           contentId),
        eq(contentTranslations.targetLanguageCode, locale),
      ));
    return { ok: false, error: result.reason };
  }

  const translatedBody     = applyTranslatedFields(srcBody, result.translated);
  const translatedTitle    = result.translated['hero.title'] ?? srcBody.hero.title;
  const translatedMetaTitle = result.translated['seo.ogTitle'] ?? null;
  const translatedMetaDesc  = result.translated['seo.ogDescription'] ?? null;

  await db
    .update(contentTranslations)
    .set({
      status:          'DRAFT',
      title:           translatedTitle,
      excerpt:         null,
      body:            JSON.stringify(translatedBody),
      metaTitle:       translatedMetaTitle,
      metaDescription: translatedMetaDesc,
      sourceHash:      srcHash,
      isAiGenerated:   true,
      failureReason:   null,
      updatedAt:       new Date(),
    })
    .where(and(
      eq(contentTranslations.entityType,         ENTITY_TYPE),
      eq(contentTranslations.entityId,           contentId),
      eq(contentTranslations.targetLanguageCode, locale),
    ));

  return { ok: true };
}

// ── Auto-generate canonical URL ───────────────────────────────────────────────

function buildCanonicalUrl(slug: string): string {
  // Turkish canonical URL points to the /tr/ locale route where ServicePageRenderer runs.
  return `${SITE.siteUrl}/tr/${slug}`;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB error';
    if (msg === 'Not found') return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
    return NextResponse.json({ error: 'DB hatası.' }, { status: 503 });
  }
}

// ── PATCH (save TR + trigger translations) ────────────────────────────────────

const patchSchema = z.object({
  title:          z.string().min(1).max(200),
  excerpt:        z.string().max(500).nullable().optional(),
  body:           z.record(z.unknown()),   // ServicePageBody as object
  seoTitle:       z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  heroImage:      z.string().max(500).nullable().optional(),
  heroImageAlt:   z.string().max(200).nullable().optional(),
  ogImage:        z.string().max(500).nullable().optional(),
  indexable:      z.boolean().optional(),
  isActive:       z.boolean().optional(),
  displayOrder:   z.number().int().optional(),
  category:       z.string().max(80).nullable().optional(),
  showOnHomepage: z.boolean().optional(),
  showInNav:      z.boolean().optional(),
  saveAsDraft:    z.boolean().default(false),
  autoTranslate:  z.boolean().default(true),
  targetLocales:  z.array(z.string().min(2).max(10)).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>> | null = null;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const row = await getContent(id);
  if (!row) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const data = parsed.data;

  if (!isServicePageBody(data.body)) {
    return NextResponse.json({ error: 'Geçersiz sayfa içeriği yapısı.' }, { status: 422 });
  }

  const bodyObj = data.body as ServicePageBody;
  const bodyStr = JSON.stringify(bodyObj);
  const srcHash = computeTranslatableHash(bodyObj);

  const { db }      = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq }      = await import('drizzle-orm');

  // Auto-generate canonical URL (Turkish pages use /tr/ prefix — that's where
  // ServicePageRenderer runs via the [lang]/[...slug] catch-all route).
  const canonicalUrl = buildCanonicalUrl(row.slug);

  // ── Draft / publish semantics ────────────────────────────────────────────
  // For a PUBLISHED page, "Taslak Kaydet" must not overwrite the live body.
  // Instead the incoming body is stored in `draftBody`; the live `body` is
  // left untouched so public visitors see no change.  On "Kaydet ve Yayımla"
  // the submitted body is promoted to `body` and `draftBody` is cleared.
  const savingDraftOfPublished = data.saveAsDraft && row.status === 'PUBLISHED';

  const updateFields = savingDraftOfPublished
    ? {
        // ONLY store the pending body draft. No live field is changed — title,
        // SEO, hero images, visibility flags, and status all remain exactly as
        // they are so public visitors see no change whatsoever.
        // All pending changes (including those metadata fields the admin may
        // have typed) are flushed to live on "Kaydet ve Yayımla".
        draftBody:  bodyStr,
        updatedAt:  new Date(),
      }
    : {
        // Draft page save or publish: update body, clear any pending draft.
        body:           bodyStr,
        draftBody:      null,
        title:          data.title,
        excerpt:        data.excerpt ?? null,
        seoTitle:       data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
        canonicalUrl,
        heroImage:      data.heroImage ?? null,
        heroImageAlt:   data.heroImageAlt ?? null,
        ogImage:        data.ogImage ?? null,
        indexable:      data.indexable ?? true,
        isActive:       data.isActive ?? true,
        displayOrder:   data.displayOrder ?? 0,
        category:       data.category ?? null,
        showOnHomepage: data.showOnHomepage ?? true,
        showInNav:      data.showInNav ?? true,
        status:         (data.saveAsDraft ? 'DRAFT' : 'PUBLISHED') as never,
        publishedAt:    data.saveAsDraft ? row.publishedAt : (row.publishedAt ?? new Date()),
        updatedAt:      new Date(),
      };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.update(content).set(updateFields as any).where(eq(content.id, id)));

  // Write audit log
  await writeAuditLog({
    contentId:   id,
    action:      savingDraftOfPublished ? 'save_draft_pending' : (data.saveAsDraft ? 'save_draft' : 'save_and_publish'),
    adminUserId: session?.adminId ?? null,
    details:     { title: data.title, autoTranslate: data.autoTranslate, savingDraftOfPublished },
  });

  // Auto-translate to non-TR locales (only when publishing, not saving draft of published)
  const translationResults: Record<string, string> = {};
  if (data.autoTranslate && !savingDraftOfPublished) {
    const targetLocales = data.targetLocales ?? await getActiveTargetLocales();
    await Promise.allSettled(
      targetLocales.map(async (locale) => {
        const r = await translateAndSave(id, bodyObj, srcHash, locale);
        translationResults[locale] = r.ok ? 'queued' : (r.error ?? 'error');
      }),
    );
  }

  const record = await getServicePageAdminRecord(id);
  return NextResponse.json({ record, translationResults });
}

// ── POST (actions on translations + source record) ────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>> | null = null;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const actionSchema = z.object({
    action: z.enum([
      'approve', 'publish', 'unpublish', 'translate',
      'archiveSource', 'publishSource', 'unpublishSource', 'duplicate',
    ]),
    locale: z.string().min(2).max(10).optional(),
  });

  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz eylem.' }, { status: 422 });
  }

  const { action, locale } = parsed.data;
  const row = await getContent(id);
  if (!row) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  const { db }                = await import('@/db');
  const { contentTranslations, content } = await import('@/db/schema');
  const { eq }                = await import('drizzle-orm');
  const adminUserId           = session?.adminId ?? null;

  // ── Source record actions ─────────────────────────────────────────────────

  if (action === 'archiveSource') {
    await db.update(content)
      .set({ status: 'ARCHIVED', updatedAt: new Date() } as never)
      .where(eq(content.id, id));
    await writeAuditLog({ contentId: id, action: 'archive_source', adminUserId });
    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  }

  if (action === 'publishSource') {
    await db.update(content)
      .set({
        status:      'PUBLISHED',
        publishedAt: row.publishedAt ?? new Date(),
        updatedAt:   new Date(),
      } as never)
      .where(eq(content.id, id));
    await writeAuditLog({ contentId: id, action: 'publish_source', adminUserId });
    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  }

  if (action === 'unpublishSource') {
    await db.update(content)
      .set({ status: 'DRAFT', updatedAt: new Date() } as never)
      .where(eq(content.id, id));
    await writeAuditLog({ contentId: id, action: 'unpublish_source', adminUserId });
    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  }

  if (action === 'duplicate') {
    // Find a collision-free slug: try slug-kopya, slug-kopya-2, slug-kopya-3 …
    const { like } = await import('drizzle-orm');
    const baseSlug = `${row.slug}-kopya`;
    const existing = await db
      .select({ slug: content.slug })
      .from(content)
      .where(like(content.slug, `${baseSlug}%`));
    const taken = new Set(existing.map(r => r.slug));
    let newSlug = baseSlug;
    if (taken.has(newSlug)) {
      let n = 2;
      while (taken.has(`${baseSlug}-${n}`)) n++;
      newSlug = `${baseSlug}-${n}`;
    }
    const newTitle = `${row.title} (Kopya)`;
    const [newRow] = await db.insert(content).values({
      contentType:    'SERVICE',
      title:          newTitle,
      slug:           newSlug,
      excerpt:        row.excerpt,
      body:           row.body,
      heroImage:      row.heroImage,
      heroImageAlt:   row.heroImageAlt,
      ogImage:        row.ogImage,
      status:         'DRAFT',
      seoTitle:       row.seoTitle,
      seoDescription: row.seoDescription,
      canonicalUrl:   buildCanonicalUrl(newSlug),
      indexable:      row.indexable,
      isActive:       false,
      displayOrder:   row.displayOrder + 1,
      category:       row.category,
      showOnHomepage: false,
      showInNav:      false,
      createdAt:      new Date(),
      updatedAt:      new Date(),
    } as never).returning({ id: content.id });

    await writeAuditLog({
      contentId:   id,
      action:      'duplicate',
      adminUserId,
      details:     { newId: newRow?.id, newSlug },
    });

    return NextResponse.json({ newId: newRow?.id, newSlug });
  }

  // ── Translation actions ─────────────────────────────────────────────────────

  if (!locale) {
    return NextResponse.json({ error: 'locale gerekli.' }, { status: 422 });
  }

  if (action === 'translate') {
    const srcBody = parseServicePageBody(row.body);
    if (!srcBody) return NextResponse.json({ error: 'TR içerik bulunamadı.' }, { status: 400 });
    const srcHash = computeTranslatableHash(srcBody);

    const existing = await getTranslation(id, locale);
    if (existing) {
      await db
        .update(contentTranslations)
        .set({ sourceHash: null, updatedAt: new Date() })
        .where(eq(contentTranslations.id, existing.id));
    }

    const result = await translateAndSave(id, srcBody, srcHash, locale);
    if (!result.ok) return NextResponse.json({ error: result.error ?? 'Çeviri hatası.' }, { status: 500 });

    await writeAuditLog({ contentId: id, action: 'translate', locale, adminUserId });
    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  }

  const existing = await getTranslation(id, locale);
  if (!existing) {
    return NextResponse.json({ error: 'Çeviri bulunamadı.' }, { status: 404 });
  }

  if (action === 'approve') {
    if (!['DRAFT', 'REVIEW', 'FAILED'].includes(existing.status)) {
      return NextResponse.json({ error: 'Yalnızca DRAFT/REVIEW/FAILED çevirileri onaylanabilir.' }, { status: 400 });
    }
    await db
      .update(contentTranslations)
      .set({ status: 'APPROVED', updatedAt: new Date() })
      .where(eq(contentTranslations.id, existing.id));
    await writeAuditLog({ contentId: id, action: 'approve_translation', locale, adminUserId });
  } else if (action === 'publish') {
    if (!['APPROVED', 'DRAFT', 'REVIEW'].includes(existing.status)) {
      return NextResponse.json({ error: 'Önce onay gereklidir.' }, { status: 400 });
    }
    await db
      .update(contentTranslations)
      .set({ status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(contentTranslations.id, existing.id));
    await writeAuditLog({ contentId: id, action: 'publish_translation', locale, adminUserId });
  } else if (action === 'unpublish') {
    await db
      .update(contentTranslations)
      .set({ status: 'DRAFT', publishedAt: null, updatedAt: new Date() })
      .where(eq(contentTranslations.id, existing.id));
    await writeAuditLog({ contentId: id, action: 'unpublish_translation', locale, adminUserId });
  }

  const record = await getServicePageAdminRecord(id);
  return NextResponse.json({ record });
}
