/**
 * Admin API for service page CMS.
 *
 * GET  /admin/api/service-pages/[id]          — full record with translations
 * PATCH /admin/api/service-pages/[id]         — save TR content + auto-translate targets
 * POST /admin/api/service-pages/[id]/approve  — approve a locale translation
 * POST /admin/api/service-pages/[id]/publish  — publish an approved locale translation
 * POST /admin/api/service-pages/[id]/translate — re-translate a specific locale
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
import 'server-only';

type Params = { params: Promise<{ id: string }> };

// ── Shared validation helpers ─────────────────────────────────────────────────

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
    // Fallback: non-source locales from the registry
    const { NON_SOURCE_LOCALES } = await import('@/lib/i18n/locale-registry');
    return [...NON_SOURCE_LOCALES];
  }
}

// ── Translate one locale and upsert ──────────────────────────────────────────

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

  // Mark as TRANSLATING
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
    // Mark FAILED
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

  const translatedBody = applyTranslatedFields(srcBody, result.translated);
  const translatedTitle = result.translated['hero.title'] ?? srcBody.hero.title;
  const translatedExcerpt = null;
  const translatedMetaTitle = result.translated['seo.ogTitle'] ?? null;
  const translatedMetaDesc  = result.translated['seo.ogDescription'] ?? null;

  const updateData = {
    status:        'DRAFT' as const,
    title:         translatedTitle,
    excerpt:       translatedExcerpt,
    body:          JSON.stringify(translatedBody),
    metaTitle:     translatedMetaTitle,
    metaDescription: translatedMetaDesc,
    sourceHash:    srcHash,
    isAiGenerated: true,
    failureReason: null,
    updatedAt:     new Date(),
  };

  await db
    .update(contentTranslations)
    .set(updateData)
    .where(and(
      eq(contentTranslations.entityType,         ENTITY_TYPE),
      eq(contentTranslations.entityId,           contentId),
      eq(contentTranslations.targetLanguageCode, locale),
    ));

  return { ok: true };
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
  canonicalUrl:   z.string().max(500).nullable().optional(),
  heroImage:      z.string().max(500).nullable().optional(),
  heroImageAlt:   z.string().max(200).nullable().optional(),
  ogImage:        z.string().max(500).nullable().optional(),
  indexable:      z.boolean().optional(),
  isActive:       z.boolean().optional(),
  displayOrder:   z.number().int().optional(),
  autoTranslate:  z.boolean().default(true),
  targetLocales:  z.array(z.string().min(2).max(10)).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireAdminSession(); } catch {
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

  // Update TR source content
  await db.update(content).set({
    title:          data.title,
    excerpt:        data.excerpt ?? null,
    body:           bodyStr,
    seoTitle:       data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    canonicalUrl:   data.canonicalUrl ?? null,
    heroImage:      data.heroImage ?? null,
    heroImageAlt:   data.heroImageAlt ?? null,
    ogImage:        data.ogImage ?? null,
    indexable:      data.indexable ?? true,
    isActive:       data.isActive ?? true,
    displayOrder:   data.displayOrder ?? 0,
    status:         'PUBLISHED' as const,
    publishedAt:    row.publishedAt ?? new Date(),
    updatedAt:      new Date(),
  }).where(eq(content.id, id));

  // Auto-translate to non-TR locales
  const translationResults: Record<string, string> = {};
  if (data.autoTranslate) {
    const targetLocales = data.targetLocales ?? await getActiveTargetLocales();

    await Promise.allSettled(
      targetLocales.map(async (locale) => {
        const r = await translateAndSave(id, bodyObj, srcHash, locale);
        translationResults[locale] = r.ok ? 'queued' : (r.error ?? 'error');
      }),
    );
  }

  // Return updated record
  const record = await getServicePageAdminRecord(id);
  return NextResponse.json({ record, translationResults });
}

// ── POST /approve ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const actionSchema = z.object({
    action: z.enum(['approve', 'publish', 'unpublish', 'translate']),
    locale: z.string().min(2).max(10),
  });

  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz eylem.' }, { status: 422 });
  }

  const { action, locale } = parsed.data;
  const row = await getContent(id);
  if (!row) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  const { db }                = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');
  const { eq }                = await import('drizzle-orm');

  const existing = await getTranslation(id, locale);

  if (action === 'translate') {
    // Re-translate
    const srcBody = parseServicePageBody(row.body);
    if (!srcBody) return NextResponse.json({ error: 'TR içerik bulunamadı.' }, { status: 400 });
    const srcHash = computeTranslatableHash(srcBody);

    // Force re-translate by temporarily clearing source hash
    if (existing) {
      await db
        .update(contentTranslations)
        .set({ sourceHash: null, updatedAt: new Date() })
        .where(eq(contentTranslations.id, existing.id));
    }

    const result = await translateAndSave(id, srcBody, srcHash, locale);
    if (!result.ok) return NextResponse.json({ error: result.error ?? 'Çeviri hatası.' }, { status: 500 });

    const record = await getServicePageAdminRecord(id);
    return NextResponse.json({ record });
  }

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
  } else if (action === 'publish') {
    if (!['APPROVED', 'DRAFT', 'REVIEW'].includes(existing.status)) {
      return NextResponse.json({ error: 'Önce onay gereklidir.' }, { status: 400 });
    }
    await db
      .update(contentTranslations)
      .set({ status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(contentTranslations.id, existing.id));
  } else if (action === 'unpublish') {
    await db
      .update(contentTranslations)
      .set({ status: 'DRAFT', publishedAt: null, updatedAt: new Date() })
      .where(eq(contentTranslations.id, existing.id));
  }

  const record = await getServicePageAdminRecord(id);
  return NextResponse.json({ record });
}
