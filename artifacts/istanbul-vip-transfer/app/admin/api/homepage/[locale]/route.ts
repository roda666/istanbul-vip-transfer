/**
 * GET /admin/api/homepage/[locale]  — fetch current (draft or published) content
 * PATCH /admin/api/homepage/[locale] — save draft
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getHomepageAdminRecord } from '@/lib/homepage-cms';
import { isHomepageSections } from '@/lib/homepage-types';

const VALID_LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const;
type Locale = typeof VALID_LOCALES[number];

function isValidLocale(l: string): l is Locale {
  return (VALID_LOCALES as readonly string[]).includes(l);
}

const HOMEPAGE_SLUG = 'ana-sayfa';

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

/** PATCH — save draft sections */
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

  const parsed = z.object({ sections: z.record(z.unknown()) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing sections payload' }, { status: 422 });
  }

  const sections = parsed.data.sections;
  if (!isHomepageSections(sections)) {
    return NextResponse.json({ error: 'Invalid sections structure' }, { status: 422 });
  }

  const sectionsJson = JSON.stringify(sections);

  try {
    const { db } = await import('@/db');
    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    if (locale === 'tr') {
      // Upsert the source Turkish content row
      const [existing] = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, HOMEPAGE_SLUG))
        .limit(1);

      let contentId: string;
      if (existing) {
        await db
          .update(content)
          .set({ body: sectionsJson, updatedAt: new Date(), title: 'Ana Sayfa' })
          .where(eq(content.id, existing.id));
        contentId = existing.id;
      } else {
        const [inserted] = await db
          .insert(content)
          .values({
            contentType: 'PAGE',
            title: 'Ana Sayfa',
            slug: HOMEPAGE_SLUG,
            body: sectionsJson,
            status: 'DRAFT',
          })
          .returning({ id: content.id });
        contentId = inserted.id;
      }

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'HOMEPAGE_SAVE_DRAFT',
        entityType: 'homepage',
        entityId: contentId,
        metadata: { locale, fields: Object.keys(sections) },
      });

      return NextResponse.json({ ok: true, contentId });
    }

    // Non-TR: upsert contentTranslation
    const [src] = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, HOMEPAGE_SLUG))
      .limit(1);

    if (!src) {
      return NextResponse.json({ error: 'Turkish source record not found — save TR first' }, { status: 409 });
    }

    const [existing] = await db
      .select({ id: contentTranslations.id })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, 'homepage'),
          eq(contentTranslations.entityId, src.id),
          eq(contentTranslations.targetLanguageCode, locale),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(contentTranslations)
        .set({ body: sectionsJson, updatedAt: new Date(), updatedBy: session.adminId })
        .where(eq(contentTranslations.id, existing.id));
    } else {
      await db.insert(contentTranslations).values({
        entityType: 'homepage',
        entityId: src.id,
        targetLanguageCode: locale,
        sourceLanguageCode: 'tr',
        status: 'DRAFT',
        body: sectionsJson,
        title: 'Homepage',
        createdBy: session.adminId,
        updatedBy: session.adminId,
      });
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'HOMEPAGE_SAVE_DRAFT',
      entityType: 'homepage',
      entityId: src.id,
      metadata: { locale, fields: Object.keys(sections) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Homepage PATCH error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}
