/**
 * GET /admin/api/homepage/[locale]  — fetch current (draft or published) content
 * PATCH /admin/api/homepage/[locale] — save draft; when locale=tr, also queues AI sync
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getHomepageAdminRecord, HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { isHomepageSections, parseHomepageSections, HOMEPAGE_FALLBACK, type HomepageSections } from '@/lib/homepage-types';
import {
  computeTranslatableHash,
  extractTranslatableFields,
  syncSharedFields,
  applyTranslatedFields,
  buildInitialTargetSections,
  resolveHomepageSyncTargets,
  isHomepageSyncCurrent,
} from '@/lib/homepage-sync';
import { translateHomepageFields } from '@/lib/ai/translate-homepage';
import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CHROME_TAG } from '@/lib/public-chrome-cache';
import 'server-only';

/**
 * A locale is manageable by the homepage editor if it is Turkish (the source)
 * or any language present in the catalog. Catalog-driven — no hardcoded list.
 */
async function isManageableLocale(locale: string): Promise<boolean> {
  if (locale === 'tr') return true;
  if (!/^[a-zA-Z-]{2,10}$/.test(locale)) return false;
  try {
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select({ code: languages.code })
      .from(languages)
      .where(eq(languages.code, locale))
      .limit(1);
    return Boolean(row);
  } catch {
    // Fallback: accept any code from the 9-locale registry
    const { isNonSourceLocale } = await import('@/lib/i18n/locale-registry');
    return locale === 'tr' || isNonSourceLocale(locale);
  }
}

const patchSchema = z.object({
  sections: z.record(z.unknown()),
  autoTranslate: z.boolean().default(true),
  /** Target locales — validated against ENABLED catalog languages at runtime. */
  targetLocales: z.array(z.string().min(2).max(10)).optional(),
  /** When true, immediately publish TR + all translated locales. Admin-controlled from the editor. */
  autoPublish: z.boolean().default(true),
});

/** GET — admin fetch for editor */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { locale } = await params;
    if (!(await isManageableLocale(locale))) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }
    const record = await getHomepageAdminRecord(locale);
    return NextResponse.json(record);
  } catch (err) {
    console.error('Homepage GET error:', err);
    return NextResponse.json({ error: 'Homepage could not be loaded', code: 'HOMEPAGE_GET_FAILED' }, { status: 503 });
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

  try {
    const { locale } = await params;
    if (!(await isManageableLocale(locale))) {
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

    const { sections: rawSections } = parsed.data;
    // A Turkish homepage save is the canonical source update. It must always
    // synchronize and publish the required public translations; request flags
    // may not silently leave a partial language set behind.
    const autoTranslate = locale === 'tr' ? true : parsed.data.autoTranslate;
    const autoPublish = locale === 'tr' ? true : parsed.data.autoPublish;
    if (!isHomepageSections(rawSections)) {
      return NextResponse.json({ error: 'Invalid sections structure' }, { status: 422 });
    }
    const sections = rawSections;
    const sectionsJson = JSON.stringify(sections);

    const { db } = await import('@/db');
    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { languages } = await import('@/db/schema');
    const { eq, and, inArray } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');

    // ── Resolve required auto-translate targets from the language catalog ──
    // Homepage saves must not silently omit one of the eight public target
    // locales (EN/DE/RU/AR/FR/ES/IT/NL). Callers cannot
    // narrow this set with a request payload.
    const enabledRows = await db
      .select({ code: languages.code })
      .from(languages)
      .where(and(
        eq(languages.isEnabled, true),
        eq(languages.providerSupported, true),
      ));
    const enabledCodes = enabledRows.map((r) => r.code);
    const { targets: targetLocales, unavailable } = resolveHomepageSyncTargets(enabledCodes);
    if (locale === 'tr' && unavailable.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'HOMEPAGE_LOCALE_UNAVAILABLE',
          message: `Homepage translation cannot start until these required locales are enabled and provider-supported: ${unavailable.join(', ')}`,
          unavailable,
        },
        { status: 409 },
      );
    }

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

    const trStatus = autoPublish ? 'PUBLISHED' : 'DRAFT';
    const trNow = new Date();
    let contentId: string;
    if (existing) {
      await db.update(content).set({
        body: sectionsJson, updatedAt: trNow, title: 'Ana Sayfa', status: trStatus, isHomepageSource: true,
        ...(autoPublish ? { publishedAt: trNow } : {}),
      }).where(eq(content.id, existing.id));
      contentId = existing.id;
    } else {
      const [inserted] = await db.insert(content).values({
        contentType: 'PAGE', title: 'Ana Sayfa', slug: HOMEPAGE_SLUG,
        body: sectionsJson, status: trStatus, isHomepageSource: true,
        ...(autoPublish ? { publishedAt: trNow } : {}),
      }).returning({ id: content.id });
      contentId = inserted.id;
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'HOMEPAGE_SAVE_DRAFT',
      entityType: 'homepage', entityId: contentId,
      metadata: { locale: 'tr', autoTranslate, targetLocales },
    });

    // Revalidate TR homepage cache immediately after save
    if (autoPublish) {
      revalidatePath('/');
      revalidateTag(PUBLIC_CHROME_TAG);
    }

    const trHash = computeTranslatableHash(sections);
    const trFields = extractTranslatableFields(sections);

    // Load existing translation rows for all eight target locales
    const existingTx = await db.select({
      id: contentTranslations.id,
      targetLanguageCode: contentTranslations.targetLanguageCode,
      status: contentTranslations.status,
      sourceHash: contentTranslations.sourceHash,
      isManuallyLocked: contentTranslations.isManuallyLocked,
      isAiGenerated: contentTranslations.isAiGenerated,
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
      status: 'skipped' | 'queued' | 'translated' | 'published' | 'locked_outdated' | 'failed';
      reason?: string;
      jobId?: string;
      aiModel?: string;
    };
    const syncResults: Record<string, SyncResult> = {};

    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    for (const targetLocale of targetLocales) {
      let tx = txByLocale[targetLocale];

      if (tx?.isManuallyLocked) {
        if (tx.sourceHash !== trHash) {
          // Hash changed while locked. Keep PUBLISHED rows serving live content (status stays
          // PUBLISHED); only non-PUBLISHED locked rows are moved to OUTDATED. Either way the
          // row stays locked so subsequent saves also skip it.
          const lockedStatus = tx.status === 'PUBLISHED' ? 'PUBLISHED' : 'OUTDATED';
          await db.update(contentTranslations).set({
            status: lockedStatus,
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

      // A later source save waits for the current owner to finish rather than
      // starting a second provider request. The owner either catches up to the
      // newest source itself or marks the row OUTDATED, which this waiting save
      // then atomically claims below.
      if (tx?.status === 'TRANSLATING' && tx.sourceHash !== trHash) {
        for (let poll = 0; poll < 96; poll += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const [refreshed] = await db.select({
            id: contentTranslations.id,
            targetLanguageCode: contentTranslations.targetLanguageCode,
            status: contentTranslations.status,
            sourceHash: contentTranslations.sourceHash,
            isManuallyLocked: contentTranslations.isManuallyLocked,
            isAiGenerated: contentTranslations.isAiGenerated,
            body: contentTranslations.body,
          }).from(contentTranslations).where(eq(contentTranslations.id, tx.id)).limit(1);
          if (!refreshed) break;
          tx = refreshed;
          if (refreshed.status !== 'TRANSLATING') break;
        }
        if (!tx || tx.status === 'TRANSLATING') {
          syncResults[targetLocale] = { status: 'queued', reason: 'Translation is still processing the latest source', jobId: tx?.id };
          continue;
        }
      }

      // An unchanged AI hash still does not mean the source is unchanged:
      // images, routes, enabled flags and other structural fields are
      // intentionally excluded from that hash. Persist those shared fields
      // without calling AI, while preserving translated text and workflow
      // status for every healthy target locale.
      if (isHomepageSyncCurrent(tx, trHash)) {
        const fallback = (HOMEPAGE_FALLBACK[targetLocale] ?? HOMEPAGE_FALLBACK.en) as HomepageSections;
        let existingTargetSections: HomepageSections | null = null;
        if (tx?.body) {
          try { existingTargetSections = JSON.parse(tx.body) as HomepageSections; }
          catch { existingTargetSections = null; }
        }
        const sharedSynced = syncSharedFields(
          existingTargetSections ?? buildInitialTargetSections(sections, fallback),
          sections,
        );
        const sharedJson = JSON.stringify(sharedSynced);
        if (sharedJson !== tx?.body) {
          await db.update(contentTranslations).set({
            body: sharedJson,
            updatedAt: new Date(),
            updatedBy: session.adminId,
          }).where(eq(contentTranslations.id, tx!.id));
          // Revalidate even for DRAFT/APPROVED rows; only a published route
          // has a visible cache entry, making this safe and idempotent.
          revalidatePath(`/${targetLocale}`);
          revalidateTag(PUBLIC_CHROME_TAG);
          syncResults[targetLocale] = {
            status: 'skipped',
            reason: 'Hash unchanged; shared fields synchronized',
            jobId: tx!.id,
          };
        } else {
          syncResults[targetLocale] = { status: 'skipped', reason: 'Hash unchanged', jobId: tx?.id };
        }
        continue;
      }

      // Guard: hash changed but translation is APPROVED or PUBLISHED.
      // For AI-generated translations (isAiGenerated=true) we always auto-retranslate —
      // no manual lock. For human-reviewed translations we lock and require explicit retry.
      // PUBLISHED rows keep their status so the public page keeps serving content.
      if (tx && tx.sourceHash !== trHash && ['APPROVED', 'PUBLISHED'].includes(tx.status ?? '') && !tx.isAiGenerated) {
        const guardStatus = tx.status === 'PUBLISHED' ? 'PUBLISHED' : 'OUTDATED';
        await db.update(contentTranslations).set({
          status: guardStatus,
          isManuallyLocked: true,
          lockedAt: new Date(),
          lockedBy: session.adminId,
          failureReason: 'Kaynak değişti — kilidi kaldırın ve yeniden çevirin.',
          updatedAt: new Date(), updatedBy: session.adminId,
          // sourceHash intentionally left unchanged: lock check needs old≠new to keep skipping
        }).where(eq(contentTranslations.id, tx.id));
        await db.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_OUTDATED',
          entityType: 'content_translation', entityId: tx.id,
          metadata: { locale: targetLocale, reason: 'approved_source_changed', keptStatus: guardStatus },
        });
        syncResults[targetLocale] = { status: 'skipped', reason: `Protected: ${guardStatus.toLowerCase()} translation locked as outdated` };
        continue;
      }
      // AI-generated PUBLISHED/APPROVED translations whose source hash changed fall through
      // to the auto-retranslation block below (no lock, always re-translate).

      const fallback = (HOMEPAGE_FALLBACK[targetLocale] ?? HOMEPAGE_FALLBACK.en) as HomepageSections;
      // Safe parse — a malformed existing body must not crash the whole save operation
      let existingTargetSections: HomepageSections | null = null;
      if (tx?.body) {
        try { existingTargetSections = JSON.parse(tx.body) as HomepageSections; }
        catch { existingTargetSections = null; /* fallback to fresh build below */ }
      }
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
          const inserted = await db.insert(contentTranslations).values({
            entityType: 'homepage', entityId: contentId,
            targetLanguageCode: targetLocale, sourceLanguageCode: 'tr',
            status: 'QUEUED', body: sharedJson, title: 'Homepage',
            sourceHash: trHash, isAiGenerated: true,
            queuedAt: sql`now()`,
            createdBy: session.adminId, updatedBy: session.adminId,
          }).onConflictDoNothing().returning({ id: contentTranslations.id });
          if (inserted[0]) {
            syncResults[targetLocale] = { status: 'queued', reason: 'AI provider not configured', jobId: inserted[0].id };
          } else {
            const [inFlight] = await db.select({
              id: contentTranslations.id,
              sourceHash: contentTranslations.sourceHash,
            }).from(contentTranslations).where(and(
              eq(contentTranslations.entityType, 'homepage'),
              eq(contentTranslations.entityId, contentId),
              eq(contentTranslations.targetLanguageCode, targetLocale),
            )).limit(1);
            if (!inFlight) throw new Error('Could not acquire homepage translation row');
            if (inFlight.sourceHash !== trHash) {
              await db.update(contentTranslations).set({
                body: sharedJson, status: 'QUEUED', sourceHash: trHash,
                queuedAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
                failureReason: null,
              }).where(eq(contentTranslations.id, inFlight.id));
            }
            syncResults[targetLocale] = { status: 'skipped', reason: 'Translation already queued', jobId: inFlight.id };
          }
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
        // Claim an existing row only if no other request is translating it.
        // This conditional update is the concurrency gate: only the caller
        // receiving a returned row is allowed to make the OpenAI request.
        const claimed = await db.update(contentTranslations).set({
          status: 'TRANSLATING', sourceHash: trHash,
          translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
          isAiGenerated: true, failureReason: null,
        }).where(and(
          eq(contentTranslations.id, tx.id),
          sql`${contentTranslations.status} <> 'TRANSLATING'`,
        )).returning({ id: contentTranslations.id });
        if (!claimed[0]) {
          syncResults[targetLocale] = { status: 'skipped', reason: 'Translation already running', jobId: tx.id };
          continue;
        }
        jobId = claimed[0].id;
      } else {
        const inserted = await db.insert(contentTranslations).values({
          entityType: 'homepage', entityId: contentId,
          targetLanguageCode: targetLocale, sourceLanguageCode: 'tr',
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
          }).from(contentTranslations).where(and(
            eq(contentTranslations.entityType, 'homepage'),
            eq(contentTranslations.entityId, contentId),
            eq(contentTranslations.targetLanguageCode, targetLocale),
          )).limit(1);
          if (!inFlight) throw new Error('Could not acquire homepage translation row');
          if (inFlight.status === 'TRANSLATING') {
            let current = inFlight;
            for (let poll = 0; poll < 96; poll += 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              const [refreshed] = await db.select({
                id: contentTranslations.id,
                sourceHash: contentTranslations.sourceHash,
                status: contentTranslations.status,
              }).from(contentTranslations).where(eq(contentTranslations.id, current.id)).limit(1);
              if (!refreshed) break;
              current = refreshed;
              if (refreshed.status !== 'TRANSLATING') break;
            }
            if (current.status === 'TRANSLATING') {
              syncResults[targetLocale] = { status: 'queued', reason: 'Translation is still processing the latest source', jobId: current.id };
              continue;
            }
            if (current.sourceHash === trHash && !['NOT_STARTED', 'FAILED', 'OUTDATED', 'ARCHIVED'].includes(current.status ?? '')) {
              syncResults[targetLocale] = { status: 'skipped', reason: 'Hash unchanged', jobId: current.id };
              continue;
            }
            const claimed = await db.update(contentTranslations).set({
              status: 'TRANSLATING', sourceHash: trHash,
              translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
              isAiGenerated: true, failureReason: null,
            }).where(and(
              eq(contentTranslations.id, current.id),
              sql`${contentTranslations.status} <> 'TRANSLATING'`,
            )).returning({ id: contentTranslations.id });
            if (!claimed[0]) {
              syncResults[targetLocale] = { status: 'queued', reason: 'Translation ownership changed', jobId: current.id };
              continue;
            }
            jobId = claimed[0].id;
          } else {
            jobId = inFlight.id;
            const claimed = await db.update(contentTranslations).set({
              status: 'TRANSLATING', sourceHash: trHash,
              translatingAt: sql`now()`, updatedAt: new Date(), updatedBy: session.adminId,
              isAiGenerated: true, failureReason: null,
            }).where(and(
              eq(contentTranslations.id, jobId),
              sql`${contentTranslations.status} <> 'TRANSLATING'`,
            )).returning({ id: contentTranslations.id });
            if (!claimed[0]) {
              syncResults[targetLocale] = { status: 'queued', reason: 'Translation ownership changed', jobId };
              continue;
            }
          }
        }
      }

      // Keep the claim while checking the canonical Turkish source after each
      // provider response. A second save that arrives mid-flight therefore
      // becomes the next iteration of this same single translation job rather
      // than starting a competing provider request.
      let sourceHashForAttempt = trHash;
      let sourceBodyForAttempt = sectionsJson;
      let fieldsForAttempt = trFields;
      let sharedForAttempt = sharedSynced;
      let aiResult: Awaited<ReturnType<typeof translateHomepageFields>> | null = null;
      let sourceKeptChanging = false;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        aiResult = await translateHomepageFields(fieldsForAttempt, targetLocale);

        const [latestSource] = await db.select({ body: content.body }).from(content)
          .where(eq(content.id, contentId)).limit(1);
        const latestSections = parseHomepageSections(latestSource?.body);
        const latestHash = latestSections ? computeTranslatableHash(latestSections) : null;

        if (latestSections && latestHash === sourceHashForAttempt) {
          // A source save may only change shared/structural fields (images,
          // routes, enabled flags, stat/card order). Those fields are excluded
          // from the AI hash but still must be taken from the newest source
          // before this in-flight translation is published.
          if (latestSource?.body !== sourceBodyForAttempt) {
            sharedForAttempt = syncSharedFields(baseTarget, latestSections);
          }
          sourceBodyForAttempt = latestSource?.body ?? sourceBodyForAttempt;
          break;
        }
        if (!latestSections || !latestHash || attempt === 2) {
          sourceKeptChanging = true;
          break;
        }

        const movedToLatestSource = await db.update(contentTranslations).set({
          sourceHash: latestHash,
          translatingAt: sql`now()`,
          updatedAt: new Date(),
          updatedBy: session.adminId,
          failureReason: null,
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
        )).returning({ id: contentTranslations.id });

        if (!movedToLatestSource[0]) {
          sourceKeptChanging = true;
          break;
        }

        sourceHashForAttempt = latestHash;
        sourceBodyForAttempt = latestSource.body ?? sourceBodyForAttempt;
        fieldsForAttempt = extractTranslatableFields(latestSections);
        sharedForAttempt = syncSharedFields(baseTarget, latestSections);
      }

      if (sourceKeptChanging || !aiResult) {
        await db.update(contentTranslations).set({
          status: 'OUTDATED',
          failureReason: 'Kaynak çeviri sırasında art arda değişti — yeniden deneyin.',
          updatedAt: new Date(), updatedBy: session.adminId,
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
        ));
        syncResults[targetLocale] = { status: 'skipped', reason: 'Source changed repeatedly while translating', jobId };
        continue;
      }

      if (!aiResult.ok) {
        const reason = aiResult.message ?? aiResult.reason;
        await db.update(contentTranslations).set({
          status: 'FAILED', failureReason: reason,
          failedAt: sql`now()`, updatedAt: new Date(),
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
        ));
        await db.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_FAILED',
          entityType: 'content_translation', entityId: jobId,
          metadata: { locale: targetLocale, reason },
        });
        syncResults[targetLocale] = { status: 'failed', reason, jobId };
        continue;
      }

      const translatedSections = applyTranslatedFields(sharedForAttempt, aiResult.translated);
      const translatedJson = JSON.stringify(translatedSections);

      const txStatus = autoPublish ? 'PUBLISHED' : 'DRAFT';
      // Atomically tie the terminal write to the exact Turkish source body
      // that was checked for this AI response. If a new Turkish save commits
      // first, this returns zero rows and cannot publish stale copy.
      const sourceStillMatches = sql`EXISTS (
        SELECT 1 FROM ${content} AS homepage_source
        WHERE homepage_source.id = ${contentId}
          AND homepage_source.body = ${sourceBodyForAttempt}
      )`;
      // Use a try-catch so a deleted session admin (FK violation) degrades
      // gracefully: retry without updatedBy rather than throwing a 500.
      let terminalWriteCompleted = false;
      try {
        const written = await db.update(contentTranslations).set({
          status: txStatus,
          body: translatedJson,
          draftAt: sql`now()`,
          ...(autoPublish ? { publishedAt: sql`now()` } : {}),
          updatedAt: new Date(),
          updatedBy: session.adminId,
          aiModel: aiResult.model,
          aiPromptVersion: '2.0',
          failureReason: null,
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
          sourceStillMatches,
        )).returning({ id: contentTranslations.id });
        terminalWriteCompleted = Boolean(written[0]);
      } catch (fkErr: unknown) {
        // FK violation: session admin was deleted before translation finished.
        const isFk = (fkErr instanceof Error) && fkErr.message.includes('updated_by_fkey');
        if (!isFk) throw fkErr;
        const written = await db.update(contentTranslations).set({
          status: txStatus,
          body: translatedJson,
          draftAt: sql`now()`,
          ...(autoPublish ? { publishedAt: sql`now()` } : {}),
          updatedAt: new Date(),
          updatedBy: null,
          aiModel: aiResult.model,
          aiPromptVersion: '2.0',
          failureReason: null,
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
          sourceStillMatches,
        )).returning({ id: contentTranslations.id });
        terminalWriteCompleted = Boolean(written[0]);
      }

      if (!terminalWriteCompleted) {
        await db.update(contentTranslations).set({
          status: 'OUTDATED',
          failureReason: 'Kaynak yayın öncesinde değişti — güncel kaynak sıraya alındı.',
          updatedAt: new Date(), updatedBy: session.adminId,
        }).where(and(
          eq(contentTranslations.id, jobId),
          eq(contentTranslations.sourceHash, sourceHashForAttempt),
          eq(contentTranslations.status, 'TRANSLATING'),
        ));
        syncResults[targetLocale] = { status: 'skipped', reason: 'Source changed before publish', jobId };
        continue;
      }

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: autoPublish ? 'HOMEPAGE_TRANSLATION_PUBLISHED' : 'HOMEPAGE_TRANSLATION_DRAFT',
        entityType: 'content_translation', entityId: jobId,
        metadata: { locale: targetLocale, model: aiResult.model, status: txStatus },
      });

      if (autoPublish) {
        revalidatePath(`/${targetLocale}`);
        revalidateTag(PUBLIC_CHROME_TAG);
      }
      syncResults[targetLocale] = { status: autoPublish ? 'published' : 'translated', jobId, aiModel: aiResult.model };
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
