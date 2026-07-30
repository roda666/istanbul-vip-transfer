/**
 * POST /admin/api/homepage/[locale]/lock
 *
 * Toggles the manual lock for a translated locale.
 *
 * Body: { locked: boolean }
 *  - locked: true  → set isManuallyLocked=true, record lockedAt/lockedBy
 *  - locked: false → clear lock; if source hash changed, queue re-translation
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { HOMEPAGE_SLUG } from '@/lib/homepage-cms';
import 'server-only';

const VALID_TARGETS = ['en', 'de', 'ru', 'ar'] as const;
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
  if (!(VALID_TARGETS as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body — expected { locked: boolean }' }, { status: 422 });

  const { locked } = parsed.data;

  const { db } = await import('@/db');
  const { content, contentTranslations, auditLogs } = await import('@/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [src] = await db.select({ id: content.id }).from(content).where(eq(content.slug, HOMEPAGE_SLUG)).limit(1);
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

  // Unlock
  await db.update(contentTranslations).set({
    isManuallyLocked: false,
    lockedAt: null, lockedBy: null,
    // If currently OUTDATED, reset to DRAFT so UI shows it's ready for re-translation
    status: tx.status === 'OUTDATED' ? 'DRAFT' : tx.status,
    updatedAt: now, updatedBy: session.adminId,
    failureReason: null,
  }).where(eq(contentTranslations.id, tx.id));

  await db.insert(auditLogs).values({
    adminUserId: session.adminId, action: 'HOMEPAGE_TRANSLATION_UNLOCK',
    entityType: 'content_translation', entityId: tx.id,
    metadata: { locale, wasOutdated: tx.status === 'OUTDATED' },
  });

  return NextResponse.json({ ok: true, locked: false });
}
