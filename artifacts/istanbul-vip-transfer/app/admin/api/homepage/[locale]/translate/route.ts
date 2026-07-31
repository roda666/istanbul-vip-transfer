/**
 * POST /admin/api/homepage/[locale]/translate
 *
 * Triggers (or retries) AI translation for a single locale from the current
 * published/draft Turkish source. Used for:
 *  - Manual retry after a failed job
 *  - Unlocking a manually-locked locale and re-translating
 *
 * Always saves result as DRAFT. Never publishes automatically.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { computeTranslatableHash, extractTranslatableFields, syncSharedFields, applyTranslatedFields, buildInitialTargetSections } from '@/lib/homepage-sync';
import { translateHomepageFields } from '@/lib/ai/translate-homepage';
import { parseHomepageSections, HOMEPAGE_FALLBACK } from '@/lib/homepage-types';
import 'server-only';

const VALID_TARGETS = ['en', 'de', 'ru', 'ar'] as const;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;
  if (!(VALID_TARGETS as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale — must be en, de, ru, or ar' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI çeviri servisi yapılandırılmamış. OPENAI_API_KEY gereklidir.' }, { status: 503 });
  }

  const { db } = await import('@/db');
  const { content, contentTranslations, auditLogs } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { sql } = await import('drizzle-orm');

  // Load TR source
  const [src] = await db.select().from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
  if (!src?.body) return NextResponse.json({ error: 'Turkish source not found' }, { status: 404 });

  const trSections = parseHomepageSections(src.body);
  if (!trSections) return NextResponse.json({ error: 'Invalid Turkish sections' }, { status: 500 });

  const trHash = computeTranslatableHash(trSections);
  const trFields = extractTranslatableFields(trSections);

  // Load existing translation row
  const [tx] = await db.select().from(contentTranslations).where(
    and(
      eq(contentTranslations.entityType, 'homepage'),
      eq(contentTranslations.entityId, src.id),
      eq(contentTranslations.targetLanguageCode, locale),
    ),
  ).limit(1);

  let jobId: string;
  if (tx) {
    await db.update(contentTranslations).set({
      status: 'TRANSLATING', sourceHash: trHash, isManuallyLocked: false,
      translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
      isAiGenerated: true, failureReason: null,
    }).where(eq(contentTranslations.id, tx.id));
    jobId = tx.id;
  } else {
    const [ins] = await db.insert(contentTranslations).values({
      entityType: 'homepage', entityId: src.id,
      targetLanguageCode: locale, sourceLanguageCode: 'tr',
      status: 'TRANSLATING', title: 'Homepage',
      sourceHash: trHash, isAiGenerated: true,
      queuedAt: sql`now()`, translatingAt: sql`now()`,
      createdBy: session.adminId, updatedBy: session.adminId,
    }).returning({ id: contentTranslations.id });
    jobId = ins.id;
  }

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_RETRY',
    entityType: 'content_translation', entityId: jobId,
    metadata: { locale },
  });

  const fallback = (HOMEPAGE_FALLBACK[locale] ?? HOMEPAGE_FALLBACK.en) as ReturnType<typeof parseHomepageSections>;
  const existingTarget = tx?.body ? parseHomepageSections(tx.body) : null;
  const base = existingTarget ?? (fallback as NonNullable<typeof fallback>);
  const sharedSynced = syncSharedFields(base ?? buildInitialTargetSections(trSections, fallback!), trSections);

  const aiResult = await translateHomepageFields(trFields, locale);

  if (!aiResult.ok) {
    const reason = aiResult.message ?? aiResult.reason;
    await db.update(contentTranslations).set({
      status: 'FAILED', failureReason: reason,
      failedAt: sql`now()`, updatedAt: new Date(),
    }).where(eq(contentTranslations.id, jobId));
    // Use 500 (not 207) so the browser's res.ok is false and the client
    // can correctly surface the error rather than showing a false-success toast.
    return NextResponse.json(
      { ok: false, success: false, error: reason, message: reason, jobId },
      { status: 500 },
    );
  }

  const translatedSections = applyTranslatedFields(sharedSynced, aiResult.translated);

  await db.update(contentTranslations).set({
    status: 'DRAFT',
    body: JSON.stringify(translatedSections),
    draftAt: sql`now()`,
    updatedAt: new Date(), updatedBy: session.adminId,
    aiModel: aiResult.model, aiPromptVersion: '2.0',
    failureReason: null, isManuallyLocked: false, lockedAt: null, lockedBy: null,
  }).where(eq(contentTranslations.id, jobId));

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_DRAFT',
    entityType: 'content_translation', entityId: jobId,
    metadata: { locale, model: aiResult.model, retried: true },
  });

  return NextResponse.json({ ok: true, jobId, model: aiResult.model });
}
