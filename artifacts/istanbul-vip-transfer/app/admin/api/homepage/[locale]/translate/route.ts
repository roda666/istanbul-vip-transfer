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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { locale } = await params;

    // Validate against the language catalog: must exist, be enabled, be
    // provider-supported, and not be the TR source itself.
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [langRow] = await db
      .select({ isEnabled: languages.isEnabled, providerSupported: languages.providerSupported })
      .from(languages)
      .where(eq(languages.code, locale))
      .limit(1);
    if (locale === 'tr' || !langRow) {
      return NextResponse.json({ error: 'Geçersiz hedef dil' }, { status: 400 });
    }
    if (!langRow.providerSupported) {
      return NextResponse.json({ error: 'Çeviri sağlayıcısı bu dili desteklemiyor.' }, { status: 400 });
    }
    if (!langRow.isEnabled) {
      return NextResponse.json({ error: 'Bu dil etkin değil — önce Dil Yönetimi sayfasından etkinleştirin.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI çeviri servisi yapılandırılmamış.', code: 'AI_PROVIDER_NOT_CONFIGURED' }, { status: 503 });
    }

    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { and } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');

    // Load TR source
    const [src] = await db.select().from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
    if (!src?.body) return NextResponse.json({ error: 'Turkish source not found' }, { status: 404 });
    const sourceBody = src.body;

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

    if (tx?.status === 'TRANSLATING' && tx.sourceHash === trHash) {
      return NextResponse.json({ ok: true, jobId: tx.id, alreadyRunning: true });
    }

    let jobId: string;
    if (tx) {
      // Atomically claim the row. A second click/request sees zero returned
      // rows and must not issue another provider call.
      const claimed = await db.update(contentTranslations).set({
        status: 'TRANSLATING', sourceHash: trHash, isManuallyLocked: false,
        translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
        isAiGenerated: true, failureReason: null,
      }).where(and(
        eq(contentTranslations.id, tx.id),
        sql`${contentTranslations.status} <> 'TRANSLATING'`,
      )).returning({ id: contentTranslations.id });
      if (!claimed[0]) {
        return NextResponse.json({ ok: true, jobId: tx.id, alreadyRunning: true });
      }
      jobId = claimed[0].id;
    } else {
      const inserted = await db.insert(contentTranslations).values({
        entityType: 'homepage', entityId: src.id,
        targetLanguageCode: locale, sourceLanguageCode: 'tr',
        status: 'TRANSLATING', title: 'Homepage',
        sourceHash: trHash, isAiGenerated: true,
        queuedAt: sql`now()`, translatingAt: sql`now()`,
        createdBy: session.adminId, updatedBy: session.adminId,
      }).onConflictDoNothing().returning({ id: contentTranslations.id });

      if (inserted[0]) {
        jobId = inserted[0].id;
      } else {
        const [inFlight] = await db.select({
          id: contentTranslations.id,
          sourceHash: contentTranslations.sourceHash,
          status: contentTranslations.status,
        }).from(contentTranslations).where(
          and(
            eq(contentTranslations.entityType, 'homepage'),
            eq(contentTranslations.entityId, src.id),
            eq(contentTranslations.targetLanguageCode, locale),
          ),
        ).limit(1);
        if (!inFlight) throw new Error('Homepage translation row was not created');
        if (inFlight.status === 'TRANSLATING' && inFlight.sourceHash === trHash) {
          return NextResponse.json({ ok: true, jobId: inFlight.id, alreadyRunning: true });
        }
        jobId = inFlight.id;
        const claimed = await db.update(contentTranslations).set({
          status: 'TRANSLATING', sourceHash: trHash, isManuallyLocked: false,
          translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
          isAiGenerated: true, failureReason: null,
        }).where(and(
          eq(contentTranslations.id, jobId),
          sql`${contentTranslations.status} <> 'TRANSLATING'`,
        )).returning({ id: contentTranslations.id });
        if (!claimed[0]) {
          return NextResponse.json({ ok: true, jobId, alreadyRunning: true });
        }
      }
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
      }).where(and(
        eq(contentTranslations.id, jobId),
        eq(contentTranslations.sourceHash, trHash),
        eq(contentTranslations.status, 'TRANSLATING'),
      ));
      return NextResponse.json(
        { ok: false, success: false, error: reason, message: reason, jobId },
        { status: 502 },
      );
    }

    const translatedSections = applyTranslatedFields(sharedSynced, aiResult.translated);

    const sourceStillMatches = sql`EXISTS (
      SELECT 1 FROM ${content} AS homepage_source
      WHERE homepage_source.id = ${src.id}
        AND homepage_source.body = ${sourceBody}
    )`;
    const written = await db.update(contentTranslations).set({
      status: 'DRAFT',
      body: JSON.stringify(translatedSections),
      draftAt: sql`now()`,
      updatedAt: new Date(), updatedBy: session.adminId,
      aiModel: aiResult.model, aiPromptVersion: '2.0',
      failureReason: null, isManuallyLocked: false, lockedAt: null, lockedBy: null,
    }).where(and(
      eq(contentTranslations.id, jobId),
      eq(contentTranslations.sourceHash, trHash),
      eq(contentTranslations.status, 'TRANSLATING'),
      sourceStillMatches,
    )).returning({ id: contentTranslations.id });

    if (!written[0]) {
      await db.update(contentTranslations).set({
        status: 'OUTDATED',
        failureReason: 'Türkçe kaynak çeviri sırasında değişti.',
        updatedAt: new Date(), updatedBy: session.adminId,
      }).where(and(
        eq(contentTranslations.id, jobId),
        eq(contentTranslations.sourceHash, trHash),
        eq(contentTranslations.status, 'TRANSLATING'),
      ));
      return NextResponse.json(
        { ok: false, success: false, code: 'HOMEPAGE_SOURCE_CHANGED', error: 'Türkçe kaynak değişti; güncel çeviri hazırlanıyor.' },
        { status: 409 },
      );
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_DRAFT',
      entityType: 'content_translation', entityId: jobId,
      metadata: { locale, model: aiResult.model, retried: true },
    });

    return NextResponse.json({ ok: true, jobId, model: aiResult.model });
  } catch (err) {
    console.error('[Homepage translation retry error]', err);
    return NextResponse.json(
      { ok: false, success: false, code: 'HOMEPAGE_TRANSLATION_FAILED', error: 'Homepage translation could not be completed.' },
      { status: 503 },
    );
  }
}
