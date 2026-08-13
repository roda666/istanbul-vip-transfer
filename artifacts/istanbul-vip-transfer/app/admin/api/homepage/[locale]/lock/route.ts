/**
 * POST /admin/api/homepage/[locale]/lock
 *
 * Toggles the manual lock for a translated locale.
 *
 * Body: { locked: boolean }
 *  - locked: true  → set isManuallyLocked=true, record lockedAt/lockedBy
 *  - locked: false → clear lock; advance sourceHash to current TR hash so the
 *                    next bulk-save does NOT re-lock the translation (admin
 *                    must use the explicit "Yeniden Çevir" button to retranslate)
 *
 * Locale validation is catalog-driven (no hard-coded language list).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import { computeTranslatableHash } from '@/lib/homepage-sync';
import { parseHomepageSections } from '@/lib/homepage-types';
import 'server-only';

const schema = z.object({ locked: z.boolean() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;

  // Catalog-driven validation: must exist, be enabled, not be TR source
  if (locale === 'tr' || !/^[a-zA-Z-]{2,10}$/.test(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const { db } = await import('@/db');
  const { languages } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const [langRow] = await db
    .select({ isEnabled: languages.isEnabled })
    .from(languages)
    .where(eq(languages.code, locale))
    .limit(1);
  if (!langRow || !langRow.isEnabled) {
    return NextResponse.json({ error: 'Invalid or disabled locale' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body — expected { locked: boolean }' }, { status: 422 });

  const { locked } = parsed.data;

  const { content, contentTranslations, auditLogs } = await import('@/db/schema');
  const { and } = await import('drizzle-orm');

  const [src] = await db.select({ id: content.id, body: content.body }).from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
  if (!src) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });

  const [tx] = await db.select({
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

  if (!tx) return NextResponse.json({ error: 'Translation record not found' }, { status: 404 });

  const now = new Date();

  if (locked) {
    await db.update(contentTranslations).set({
      isManuallyLocked: true,
      lockedAt: now,
      lockedBy: session.adminId,
      updatedAt: now, updatedBy: session.adminId,
    }).where(eq(contentTranslations.id, tx.id));

    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_LOCK',
      entityType: 'content_translation', entityId: tx.id,
      metadata: { locale, locked: true },
    });

    return NextResponse.json({ ok: true, locked: true });
  }

  // ── Unlock ────────────────────────────────────────────────────────────────
  // Advance sourceHash to the current TR content hash so the next automatic
  // TR save sees "hash unchanged" and skips this locale. The admin must use
  // the explicit "Yeniden Çevir" button to trigger a fresh translation.
  // This prevents the re-lock loop: unlock → save TR → guard re-locks.
  let advancedHash: string | null = null;
  if (src.body) {
    try {
      const trSections = parseHomepageSections(src.body);
      if (trSections) advancedHash = computeTranslatableHash(trSections);
    } catch { /* keep advancedHash null — sourceHash stays unchanged */ }
  }

  await db.update(contentTranslations).set({
    isManuallyLocked: false,
    lockedAt: null, lockedBy: null,
    // PUBLISHED stays PUBLISHED (keeps serving live content); OUTDATED → DRAFT (ready to retry)
    status: tx.status === 'OUTDATED' ? 'DRAFT' : tx.status,
    // Advance hash to current TR so subsequent auto-saves don't re-lock immediately
    ...(advancedHash ? { sourceHash: advancedHash } : {}),
    updatedAt: now, updatedBy: session.adminId,
    failureReason: null,
  }).where(eq(contentTranslations.id, tx.id));

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_UNLOCK',
    entityType: 'content_translation', entityId: tx.id,
    metadata: { locale, wasOutdated: tx.status === 'OUTDATED', advancedHash: Boolean(advancedHash) },
  });

  return NextResponse.json({ ok: true, locked: false });
}
