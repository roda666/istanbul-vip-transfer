/**
 * GET /admin/api/homepage/[locale]  — fetch current (draft or published) content
 * PATCH /admin/api/homepage/[locale] — save draft; Turkish saves enqueue AI sync
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getHomepageAdminRecord, HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { isHomepageSections } from '@/lib/homepage-types';
import { computeTranslatableHash, resolveHomepageSyncTargets } from '@/lib/homepage-sync';
import { revalidatePath, revalidateTag } from 'next/cache';
import { PUBLIC_CHROME_TAG } from '@/lib/public-chrome-cache';
import {
  computeCustomerContentSourceHash,
  enqueueCustomerContentTranslations,
} from '@/lib/customer-content-translation';
import 'server-only';

async function isManageableLocale(locale: string): Promise<boolean> {
  if (locale === 'tr') return true;
  if (!/^[a-zA-Z-]{2,10}$/.test(locale)) return false;
  try {
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select({ code: languages.code }).from(languages)
      .where(eq(languages.code, locale)).limit(1);
    return Boolean(row);
  } catch {
    const { isNonSourceLocale } = await import('@/lib/i18n/locale-registry');
    return isNonSourceLocale(locale);
  }
}

const patchSchema = z.object({
  sections: z.record(z.unknown()),
  autoTranslate: z.boolean().default(true),
  targetLocales: z.array(z.string().min(2).max(10)).optional(),
  autoPublish: z.boolean().default(true),
});

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
    return NextResponse.json(await getHomepageAdminRecord(locale));
  } catch (err) {
    console.error('Homepage GET error:', err);
    return NextResponse.json(
      { error: 'Homepage could not be loaded', code: 'HOMEPAGE_GET_FAILED' },
      { status: 503 },
    );
  }
}

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
    if (!parsed.success || !isHomepageSections(parsed.data.sections)) {
      return NextResponse.json({ error: 'Missing or invalid sections payload' }, { status: 422 });
    }

    const { db } = await import('@/db');
    const { content, contentTranslations, auditLogs, languages } = await import('@/db/schema');
    const { and, eq } = await import('drizzle-orm');
    const { sql } = await import('drizzle-orm');
    const sections = parsed.data.sections;
    const sectionsJson = JSON.stringify(sections);
    const autoTranslate = locale === 'tr' ? true : parsed.data.autoTranslate;
    const autoPublish = locale === 'tr' ? true : parsed.data.autoPublish;

    const enabledRows = await db.select({ code: languages.code }).from(languages)
      .where(and(eq(languages.isEnabled, true), eq(languages.providerSupported, true)));
    const { targets: targetLocales, unavailable } = resolveHomepageSyncTargets(
      enabledRows.map(row => row.code),
    );
    if (locale === 'tr' && unavailable.length > 0) {
      return NextResponse.json({
        success: false,
        code: 'HOMEPAGE_LOCALE_UNAVAILABLE',
        message: `Homepage translation cannot start until these required locales are enabled and provider-supported: ${unavailable.join(', ')}`,
        unavailable,
      }, { status: 409 });
    }

    if (locale !== 'tr') {
      const [source] = await db.select({ id: content.id }).from(content)
        .where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
      if (!source) {
        return NextResponse.json({
          success: false,
          code: 'TR_NOT_FOUND',
          message: 'Türkçe kaynak bulunamadı — önce TR taslağını kaydedin.',
        }, { status: 409 });
      }
      const [existing] = await db.select({ id: contentTranslations.id })
        .from(contentTranslations).where(and(
          eq(contentTranslations.entityType, 'homepage'),
          eq(contentTranslations.entityId, source.id),
          eq(contentTranslations.targetLanguageCode, locale),
        )).limit(1);
      if (existing) {
        await db.update(contentTranslations).set({
          body: sectionsJson, updatedAt: new Date(), updatedBy: session.adminId,
          status: 'DRAFT', draftAt: sql`now()`,
        }).where(eq(contentTranslations.id, existing.id));
      } else {
        await db.insert(contentTranslations).values({
          entityType: 'homepage', entityId: source.id,
          targetLanguageCode: locale, sourceLanguageCode: 'tr',
          status: 'DRAFT', body: sectionsJson, title: 'Homepage',
          createdBy: session.adminId, updatedBy: session.adminId,
          draftAt: sql`now()`,
        });
      }
      await db.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'HOMEPAGE_SAVE_DRAFT',
        entityType: 'homepage', entityId: source.id,
        metadata: { locale, manual: true },
      });
      revalidatePath(`/${locale}`);
      revalidateTag(PUBLIC_CHROME_TAG);
      return NextResponse.json({ success: true, draftSaved: true });
    }

    const [existing] = await db.select({ id: content.id }).from(content)
      .where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
    const trStatus = autoPublish ? 'PUBLISHED' : 'DRAFT';
    const trNow = new Date();
    let contentId: string;
    if (existing) {
      await db.update(content).set({
        body: sectionsJson, updatedAt: trNow, title: 'Ana Sayfa',
        status: trStatus, isHomepageSource: true,
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
    revalidatePath('/');
    revalidateTag(PUBLIC_CHROME_TAG);

    const orchestration = await enqueueCustomerContentTranslations({
      entityType: 'homepage',
      entityId: contentId,
      sourceHash: computeCustomerContentSourceHash(sections),
      adminId: session.adminId,
    });
    const syncResults = Object.fromEntries(targetLocales.map(targetLocale => [
      targetLocale, { status: 'queued', jobId: orchestration.jobId },
    ]));
    return NextResponse.json({
      success: true,
      draftSaved: true,
      translationJobsCreated: orchestration.created ? orchestration.taskCount : 0,
      translationJobId: orchestration.jobId,
      targetLocales,
      trHash: computeTranslatableHash(sections),
      syncResults,
    });
  } catch (err) {
    console.error('[PATCH /admin/api/homepage/:locale] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.';
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}