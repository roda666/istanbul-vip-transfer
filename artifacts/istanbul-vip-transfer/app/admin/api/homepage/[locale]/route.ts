/**
 * GET /admin/api/homepage/[locale]  — fetch current (draft or published) content
 * PATCH /admin/api/homepage/[locale] — save draft; when locale=tr, also queues AI sync
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getHomepageAdminRecord, HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { isHomepageSections, HOMEPAGE_FALLBACK, type HomepageSections } from '@/lib/homepage-types';
import {
  computeTranslatableHash,
  extractTranslatableFields,
  syncSharedFields,
  applyTranslatedFields,
  buildInitialTargetSections,
} from '@/lib/homepage-sync';
import { translateHomepageFields } from '@/lib/ai/translate-homepage';
import 'server-only';

const VALID_LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
type Locale = typeof VALID_LOCALES[number];

function isValidLocale(l: string): l is Locale {
  return (VALID_LOCALES as readonly string[]).includes(l);
}

const patchSchema = z.object({
  sections: z.record(z.unknown()),
  autoTranslate: z.boolean().default(true),
  targetLocales: z.array(z.enum(['en', 'de', 'ru', 'ar'])).default(['en', 'de', 'ru', 'ar']),
});

/** GET — admin fetch for editor */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;
  if (!isValidLocale(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  try {
    const record = await getHomepageAdminRecord(locale);
    return NextResponse.json(record);
  } catch (err) {
    console.error('Homepage GET error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}

/** PATCH — save draft sections (TR: also queues/runs AI sync for target locales) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;
  if (!isValidLocale(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing or invalid sections payload' }, { status: 422 });
  }

  const { sections: rawSections, autoTranslate, targetLocales } = parsed.data;
  if (!isHomepageSections(rawSections)) {
    return NextResponse.json({ error: 'Invalid sections structure' }, { status: 422 });
  }
  const sections = rawSections;
  const sectionsJson = JSON.stringify(sections);

  try {
    const { db } = await import('@/db');
    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { eq, and, inArray } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');

    // ── Non-TR save (manual edit) ──────────────────────────────────────────
    if (locale !== 'tr') {
      const [src] = await db.select({ id: content.id }).from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
      if (!src) return NextResponse.json(
        { success: false, code: 'TR_NOT_FOUND', message: 'Türkçe kaynak bulunamadı — önce TR taslağını kaydedin.' },
        { status: 409 },
      );

      const [existing] = await db.select({ id: contentTranslations.id }).from(contentTranslations).where(
        and(
          eq(contentTranslations.entityType, 'homepage'),
          eq(contentTranslations.entityId, src.id),
          eq(contentTranslations.targetLanguageCode, locale),
        ),
      ).limit(1);

      if (existing) {
        await db.update(contentTranslations).set({
          body: sectionsJson, updatedAt: new Date(), updatedBy: session.adminId,
          status: 'DRAFT', draftAt: sql`now()`,
        }).where(eq(contentTranslations.id, existing.id));
      } else {
        await db.insert(contentTranslations).values({
          entityType: 'homepage', entityId: src.id,
          targetLanguageCode: locale, sourceLanguageCode: 'tr',
          status: 'DRAFT', body: sectionsJson, title: 'Homepage',
          createdBy: session.adminId, updatedBy: session.adminId,
          draftAt: sql`now()`,
        });
      }

      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'HOMEPAGE_SAVE_DRAFT',
        entityType: 'homepage', entityId: src.id,
        metadata: { locale, manual: true },
      });

      return NextResponse.json({ success: true, draftSaved: true });
    }

    // ── TR save ────────────────────────────────────────────────────────────
    const [existing] = await db.select({ id: content.id }).from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);

    let contentId: string;
    if (existing) {
      await db.update(content).set({ body: sectionsJson, updatedAt: new Date(), title: 'Ana Sayfa' }).where(eq(content.id, existing.id));
      contentId = existing.id;
    } else {
      const [inserted] = await db.insert(content).values({
        contentType: 'PAGE', title: 'Ana Sayfa', slug: HOMEPAGE_SLUG,
        body: sectionsJson, status: 'DRAFT',
      }).returning({ id: content.id });
      contentId = inserted.id;
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'HOMEPAGE_SAVE_DRAFT',
      entityType: 'homepage', entityId: contentId,
      metadata: { locale: 'tr', autoTranslate, targetLocales },
    });

    // ── If autoTranslate disabled, return early ────────────────────────────
    if (!autoTranslate || targetLocales.length === 0) {
      return NextResponse.json({ success: true, draftSaved: true, translationJobsCreated: 0, targetLocales: [] });
    }

    const trHash = computeTranslatableHash(sections);
    const trFields = extractTranslatableFields(sections);

    // Load existing translation rows for all 4 target locales
    const existingTx = await db.select({
      id: contentTranslations.id,
      targetLanguageCode: contentTranslations.targetLanguageCode,
      status: contentTranslations.status,
      sourceHash: contentTranslations.sourceHash,
      isManuallyLocked: contentTranslations.isManuallyLocked,
      body: contentTranslations.body,
    }).from(contentTranslations).where(
      and(
        eq(contentTranslations.entityType, 'homepage'),
        eq(contentTranslations.entityId, contentId),
        inArray(contentTranslations.targetLanguageCode, [...targetLocales]),
      ),
    );

    const txByLocale = Object.fromEntries(existingTx.map(r => [r.targetLanguageCode, r]));

    type SyncResult = {
      status: 'skipped' | 'queued' | 'translated' | 'locked_outdated' | 'failed';
      reason?: string;
      jobId?: string;
      aiModel?: string;
    };
    const syncResults: Record<string, SyncResult> = {};

    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    for (const targetLocale of targetLocales) {
      const tx = txByLocale[targetLocale];

      if (tx?.isManuallyLocked) {
        if (tx.sourceHash !== trHash) {
          await db.update(contentTranslations).set({
            status: 'OUTDATED',
            failureReason: 'Kaynak değişti — güncelleme gerekli',
            updatedAt: new Date(), updatedBy: session.adminId,
          }).where(eq(contentTranslations.id, tx.id));
          await db.insert(auditLogs).values({
            adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_OUTDATED',
            entityType: 'content_translation', entityId: tx.id,
            metadata: { locale: targetLocale, reason: 'manual_lock_source_changed' },
          });
          syncResults[targetLocale] = { status: 'locked_outdated', reason: 'Source changed while locked' };
        } else {
          syncResults[targetLocale] = { status: 'skipped', reason: 'Locked and hash unchanged' };
        }
        continue;
      }

      // Skip if hash unchanged and already in a good state
      if (tx && tx.sourceHash === trHash && !['NOT_STARTED', 'FAILED', 'OUTDATED'].includes(tx.status ?? '')) {
        syncResults[targetLocale] = { status: 'skipped', reason: 'Hash unchanged' };
        continue;
      }

      const fallback = (HOMEPAGE_FALLBACK[targetLocale] ?? HOMEPAGE_FALLBACK.en) as HomepageSections;
      const existingTargetSections = tx?.body ? (JSON.parse(tx.body) as HomepageSections) : null;
      const baseTarget = existingTargetSections ?? buildInitialTargetSections(sections, fallback);
      const sharedSynced = syncSharedFields(baseTarget, sections);

      if (!hasOpenAI) {
        const sharedJson = JSON.stringify(sharedSynced);
        if (tx) {
          await db.update(contentTranslations).set({
            body: sharedJson, status: 'QUEUED', sourceHash: trHash,
            queuedAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
            failureReason: null,
          }).where(eq(contentTranslations.id, tx.id));
          syncResults[targetLocale] = { status: 'queued', reason: 'AI provider not configured', jobId: tx.id };
        } else {
          const [ins] = await db.insert(contentTranslations).values({
            entityType: 'homepage', entityId: contentId,
            targetLanguageCode: targetLocale, sourceLanguageCode: 'tr',
            status: 'QUEUED', body: sharedJson, title: 'Homepage',
            sourceHash: trHash, isAiGenerated: true,
            queuedAt: sql`now()`,
            createdBy: session.adminId, updatedBy: session.adminId,
          }).returning({ id: contentTranslations.id });
          syncResults[targetLocale] = { status: 'queued', reason: 'AI provider not configured', jobId: ins.id };
        }
        await db.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_QUEUED',
          entityType: 'homepage', entityId: contentId,
          metadata: { locale: targetLocale, reason: 'no_openai_key' },
        });
        continue;
      }

      // ── Run AI translation ─────────────────────────────────────────────
      let jobId: string;
      if (tx) {
        await db.update(contentTranslations).set({
          status: 'TRANSLATING', sourceHash: trHash,
          translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
          isAiGenerated: true, failureReason: null,
        }).where(eq(contentTranslations.id, tx.id));
        jobId = tx.id;
      } else {
        const [ins] = await db.insert(contentTranslations).values({
          entityType: 'homepage', entityId: contentId,
          targetLanguageCode: targetLocale, sourceLanguageCode: 'tr',
          status: 'TRANSLATING', title: 'Homepage',
          sourceHash: trHash, isAiGenerated: true,
          queuedAt: sql`now()`, translatingAt: sql`now()`,
          createdBy: session.adminId, updatedBy: session.adminId,
        }).returning({ id: contentTranslations.id });
        jobId = ins.id;
      }

      const aiResult = await translateHomepageFields(trFields, targetLocale);

      if (!aiResult.ok) {
        const reason = aiResult.message ?? aiResult.reason;
        await db.update(contentTranslations).set({
          status: 'FAILED', failureReason: reason,
          failedAt: sql`now()`, updatedAt: new Date(),
        }).where(eq(contentTranslations.id, jobId));
        await db.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_FAILED',
          entityType: 'content_translation', entityId: jobId,
          metadata: { locale: targetLocale, reason },
        });
        syncResults[targetLocale] = { status: 'failed', reason, jobId };
        continue;
      }

      const translatedSections = applyTranslatedFields(sharedSynced, aiResult.translated);
      const translatedJson = JSON.stringify(translatedSections);

      await db.update(contentTranslations).set({
        status: 'DRAFT',
        body: translatedJson,
        draftAt: sql`now()`,
        updatedAt: new Date(),
        updatedBy: session.adminId,
        aiModel: aiResult.model,
        aiPromptVersion: '2.0',
        failureReason: null,
      }).where(eq(contentTranslations.id, jobId));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_DRAFT',
        entityType: 'content_translation', entityId: jobId,
        metadata: { locale: targetLocale, model: aiResult.model, status: 'DRAFT' },
      });

      syncResults[targetLocale] = { status: 'translated', jobId, aiModel: aiResult.model };
    }

    const jobsCreated = Object.values(syncResults).filter(r => r.status !== 'skipped').length;
    const activeTargets = Object.entries(syncResults)
      .filter(([, r]) => r.status !== 'skipped')
      .map(([locale]) => locale);

    const hasAiProvider = hasOpenAI;
    if (!hasAiProvider && jobsCreated > 0) {
      return NextResponse.json({
        success: true,
        draftSaved: true,
        translationJobsCreated: jobsCreated,
        targetLocales: activeTargets,
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        message: `Türkçe taslak kaydedildi. AI sağlayıcısı yapılandırılmamış — ${jobsCreated} dil sıraya alındı.`,
        syncResults,
      });
    }

    return NextResponse.json({
      success: true,
      draftSaved: true,
      translationJobsCreated: jobsCreated,
      targetLocales: activeTargets,
      trHash,
      syncResults,
    });

  } catch (err) {
    console.error('[PATCH /admin/api/homepage/:locale] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.';
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message },
      { status: 500 },
    );
  }
}
