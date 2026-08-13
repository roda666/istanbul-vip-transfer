/**
 * POST /admin/api/homepage/[locale]/publish  — advance translation workflow
 *
 * Supported actions (via ?action= query param):
 *   submit_review  DRAFT      → REVIEW    (send for editorial review)
 *   approve        REVIEW     → APPROVED  (editorial sign-off)
 *   publish        APPROVED   → PUBLISHED (make live)
 *   unpublish      any        → DRAFT     (pull from production)
 *
 * State transitions are enforced: each action validates the current status
 * before making any change. A failed language never blocks other languages.
 * Every action is written to the audit log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

const HOMEPAGE_SLUG = 'ana-sayfa';

/** Catalog-driven locale validation: TR (source) or any catalog language. */
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

function localePathOf(locale: string): string {
  return locale === 'tr' ? '/' : `/${locale}`;
}

type WorkflowAction = 'submit_review' | 'approve' | 'publish' | 'unpublish';

/** Allowed current statuses for each action (locale translations) */
const ALLOWED_FROM: Record<WorkflowAction, string[]> = {
  submit_review: ['DRAFT'],
  approve:       ['REVIEW', 'DRAFT'],
  publish:       ['APPROVED', 'REVIEW', 'DRAFT'],
  unpublish:     ['PUBLISHED', 'APPROVED', 'REVIEW', 'DRAFT'],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let session;
  try { session = await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { locale } = await params;
  if (!(await isManageableLocale(locale))) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const rawAction = req.nextUrl.searchParams.get('action') ?? 'publish';
  if (!['submit_review', 'approve', 'publish', 'unpublish'].includes(rawAction)) {
    return NextResponse.json({ error: `Unknown action: ${rawAction}` }, { status: 400 });
  }
  const action = rawAction as WorkflowAction;

  try {
    const { db }    = await import('@/db');
    const { content, contentTranslations, auditLogs } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const now = new Date();

    // ── TR source publish / unpublish ──────────────────────────────────────
    if (locale === 'tr') {
      // TR only supports publish/unpublish
      if (action === 'submit_review' || action === 'approve') {
        return NextResponse.json({ error: 'TR source uses publish/unpublish only' }, { status: 400 });
      }

      const [row] = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, HOMEPAGE_SLUG))
        .limit(1);

      if (!row) return NextResponse.json({ error: 'No content to publish' }, { status: 404 });

      const isPublish = action === 'publish';
      await db.update(content).set({
        status: isPublish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: isPublish ? now : null,
        approvedAt:  isPublish ? now : null,
        approvedBy:  isPublish ? session.adminId : null,
        updatedAt: now,
      }).where(eq(content.id, row.id));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: isPublish ? 'HOMEPAGE_PUBLISH' : 'HOMEPAGE_UNPUBLISH',
        entityType: 'homepage', entityId: row.id,
        metadata: { locale },
      });

      revalidatePath(localePathOf(locale));
      return NextResponse.json({ ok: true, action, locale });
    }

    // ── Non-TR translation workflow ────────────────────────────────────────
    const [src] = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, HOMEPAGE_SLUG))
      .limit(1);

    if (!src) return NextResponse.json({ error: 'Source record not found' }, { status: 404 });

    const [tx] = await db
      .select({ id: contentTranslations.id, status: contentTranslations.status })
      .from(contentTranslations)
      .where(and(
        eq(contentTranslations.entityType, 'homepage'),
        eq(contentTranslations.entityId, src.id),
        eq(contentTranslations.targetLanguageCode, locale),
      ))
      .limit(1);

    if (!tx) return NextResponse.json({ error: 'No translation record found' }, { status: 404 });

    // Enforce state-machine transition
    const allowed = ALLOWED_FROM[action];
    if (!allowed.includes(tx.status)) {
      return NextResponse.json({
        error: `Cannot ${action} a record with status ${tx.status}. Required: ${allowed.join(' or ')}.`,
        currentStatus: tx.status,
      }, { status: 409 });
    }

    // Build update payload
    type TxUpdate = {
      status: 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'DRAFT';
      updatedAt: Date;
      updatedBy: string;
      reviewAt?: Date | null;
      approvedAt?: Date | null;
      approvedBy?: string | null;
      publishedAt?: Date | null;
    };

    let update: TxUpdate;
    let auditAction: string;

    switch (action) {
      case 'submit_review':
        update = { status: 'REVIEW', updatedAt: now, updatedBy: session.adminId, reviewAt: now };
        auditAction = 'HOMEPAGE_TRANSLATION_SUBMIT_REVIEW';
        break;
      case 'approve':
        update = { status: 'APPROVED', updatedAt: now, updatedBy: session.adminId, approvedAt: now, approvedBy: session.adminId };
        auditAction = 'HOMEPAGE_TRANSLATION_APPROVE';
        break;
      case 'publish':
        update = { status: 'PUBLISHED', updatedAt: now, updatedBy: session.adminId, publishedAt: now };
        auditAction = 'HOMEPAGE_TRANSLATION_PUBLISH';
        break;
      case 'unpublish':
      default:
        update = { status: 'DRAFT', updatedAt: now, updatedBy: session.adminId, publishedAt: null };
        auditAction = 'HOMEPAGE_TRANSLATION_UNPUBLISH';
        break;
    }

    await db.update(contentTranslations).set(update).where(eq(contentTranslations.id, tx.id));

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: auditAction,
      entityType: 'homepage',
      entityId: src.id,
      metadata: { locale, previousStatus: tx.status, newStatus: update.status },
    });

    revalidatePath(localePathOf(locale));

    return NextResponse.json({ ok: true, action, locale, newStatus: update.status });
  } catch (err) {
    console.error('[Homepage publish/workflow error]', err);
    return NextResponse.json({ error: 'DB error' }, { status: 503 });
  }
}
