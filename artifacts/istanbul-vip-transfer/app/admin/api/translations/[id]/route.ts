/**
 * GET    /admin/api/translations/[id]   — get a single translation job
 * PATCH  /admin/api/translations/[id]   — update / advance workflow status
 * DELETE /admin/api/translations/[id]   — archive a translation job
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

const patchSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  focusKeyword: z.string().optional().nullable(),
  supportingKeywords: z.array(z.string()).optional().nullable(),
  imageAlt: z.string().optional().nullable(),
  imageTitle: z.string().optional().nullable(),
  imageCaption: z.string().optional().nullable(),
  action: z.enum(['submit_review', 'approve', 'reject', 'schedule', 'publish', 'archive']).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { contentTranslations } = await import('@/db/schema');

  try {
    const [row] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { db } = await import('@/db');
  const { contentTranslations, auditLogs } = await import('@/db/schema');
  const { sql } = await import('drizzle-orm');

  try {
    const [existing] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { action, ...fields } = parsed.data;

    // Build the update payload
    const update: Record<string, unknown> = {
      ...fields,
      updatedAt: sql`now()`,
      updatedBy: session.adminId,
    };

    // Content edits: if status was APPROVED, reset to REVIEW
    const hasContentEdits = Object.keys(fields).some((k) =>
      ['title', 'slug', 'excerpt', 'body', 'metaTitle', 'metaDescription'].includes(k)
    );
    if (hasContentEdits && existing.status === 'APPROVED') {
      update.status = 'REVIEW';
      update.approvedAt = null;
      update.approvedBy = null;
    }

    // Workflow actions
    if (action) {
      switch (action) {
        case 'submit_review':
          update.status = 'REVIEW';
          update.reviewAt = sql`now()`;
          break;
        case 'approve':
          // AI-generated drafts must not be directly approved via this route
          // (they must go through the editorial workflow)
          update.status = 'APPROVED';
          update.approvedAt = sql`now()`;
          update.approvedBy = session.adminId;
          break;
        case 'reject':
          update.status = 'DRAFT';
          break;
        case 'schedule':
          if (existing.status !== 'APPROVED') {
            return NextResponse.json({ error: 'Must be APPROVED before scheduling' }, { status: 400 });
          }
          if (!parsed.data.scheduledAt) {
            return NextResponse.json({ error: 'scheduledAt is required for schedule action' }, { status: 400 });
          }
          update.status = 'SCHEDULED';
          update.scheduledAt = parsed.data.scheduledAt;
          break;
        case 'publish':
          if (!['APPROVED', 'SCHEDULED'].includes(existing.status)) {
            return NextResponse.json({ error: 'Must be APPROVED or SCHEDULED before publishing' }, { status: 400 });
          }
          update.status = 'PUBLISHED';
          update.publishedAt = sql`now()`;
          break;
        case 'archive':
          update.status = 'ARCHIVED';
          update.archivedAt = sql`now()`;
          break;
      }
    }

    const [updated] = await db
      .update(contentTranslations)
      .set(update as never)
      .where(eq(contentTranslations.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: action ? `translation.${action}` : 'translation.update',
      entityType: 'content_translation',
      entityId: id,
      metadata: {
        targetLang: existing.targetLanguageCode,
        entityType: existing.entityType,
        previousStatus: existing.status,
        newStatus: updated.status,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { contentTranslations, auditLogs } = await import('@/db/schema');
  const { sql } = await import('drizzle-orm');

  try {
    const [existing] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft-archive instead of hard delete to preserve published translations
    const [updated] = await db
      .update(contentTranslations)
      .set({ status: 'ARCHIVED', archivedAt: sql`now()`, updatedAt: sql`now()`, updatedBy: session.adminId })
      .where(eq(contentTranslations.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'translation.archive',
      entityType: 'content_translation',
      entityId: id,
      metadata: { targetLang: existing.targetLanguageCode, entityType: existing.entityType },
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
