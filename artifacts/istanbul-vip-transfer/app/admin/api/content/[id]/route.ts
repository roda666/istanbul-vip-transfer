import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  body: z.string().optional().nullable(),
  heroImage: z.string().max(500).optional().nullable(),
  heroImageAlt: z.string().max(200).optional().nullable(),
  // APPROVED and PUBLISHED may only be set via explicit action endpoints.
  // SCHEDULED is permitted only when current record is already APPROVED.
  // ARCHIVED is allowed as a soft-delete via update.
  status: z.enum(['DRAFT', 'RESEARCH', 'REVIEW', 'SCHEDULED', 'ARCHIVED']).optional(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(400).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  indexable: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const actionSchema = z.object({
  action: z.enum(['approve', 'publish', 'archive']),
});

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/content/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db.select().from(content).where(eq(content.id, id)).limit(1).catch(() => []);
  if (!rows[0]) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

/** PUT /api/admin/content/[id] — update content, applying approval reset if needed */
export async function PUT(request: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  const data = parsed.data;
  const { db } = await import('@/db');
  const { content, auditLogs } = await import('@/db/schema');
  const { eq, and, or } = await import('drizzle-orm');

  // Fetch current record
  const [current] = await db.select({ id: content.id, status: content.status }).from(content).where(eq(content.id, id)).limit(1).catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  const { getApprovalReset } = await import('@/lib/workflow');
  const { sanitizeHtml, sanitizeText } = await import('@/lib/sanitize');

  // Enforce workflow transition rules on the requested status change.
  // APPROVED and PUBLISHED are blocked at the schema level (see updateSchema).
  // SCHEDULED requires the record to already be APPROVED and a scheduledAt present.
  if (data.status === 'SCHEDULED') {
    if (current.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Zamanlamak için içeriğin önce onaylanmış (APPROVED) durumunda olması gerekir.' },
        { status: 422 },
      );
    }
    const incomingScheduledAt = data.scheduledAt;
    // Require scheduledAt either in the new data or already on the record
    if (!incomingScheduledAt) {
      return NextResponse.json(
        { error: 'Zamanlanmış içerik için bir yayın tarihi gereklidir.' },
        { status: 422 },
      );
    }
  }

  // Apply approval reset when editing APPROVED or SCHEDULED content — UNLESS the
  // caller is intentionally moving APPROVED → SCHEDULED. That is a valid forward
  // transition that must preserve approvedAt/approvedBy (required for public visibility).
  const isSchedulingTransition =
    data.status === 'SCHEDULED' && current.status === 'APPROVED';
  const reset = isSchedulingTransition
    ? null
    : getApprovalReset(current.status as Parameters<typeof getApprovalReset>[0]);
  const approvalFields = reset ?? {};

  try {
    const [updated] = await db
      .update(content)
      .set({
        ...(data.title !== undefined && { title: sanitizeText(data.title) }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt ? sanitizeText(data.excerpt) : null }),
        ...(data.body !== undefined && { body: data.body ? sanitizeHtml(data.body) : null }),
        ...(data.heroImage !== undefined && { heroImage: data.heroImage ? sanitizeText(data.heroImage) : null }),
        ...(data.heroImageAlt !== undefined && { heroImageAlt: data.heroImageAlt ? sanitizeText(data.heroImageAlt) : null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle ? sanitizeText(data.seoTitle) : null }),
        ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription ? sanitizeText(data.seoDescription) : null }),
        ...(data.canonicalUrl !== undefined && { canonicalUrl: data.canonicalUrl ? sanitizeText(data.canonicalUrl) : null }),
        ...(data.indexable !== undefined && { indexable: data.indexable }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...approvalFields,
        updatedAt: new Date(),
      })
      .where(eq(content.id, id))
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'Content',
      entityId: id,
      metadata: { resetApproval: !!reset, newStatus: updated.status },
    }).catch(() => {});

    // Mark existing PUBLISHED / APPROVED translations as OUTDATED
    // so editors know the source content changed.
    try {
      const { contentTranslations } = await import('@/db/schema');
      await db
        .update(contentTranslations)
        .set({ status: 'OUTDATED', updatedAt: new Date() })
        .where(
          and(
            eq(contentTranslations.entityType, 'content'),
            eq(contentTranslations.entityId, id),
            or(
              eq(contentTranslations.status, 'PUBLISHED' as never),
              eq(contentTranslations.status, 'APPROVED' as never),
            ),
          ),
        );
    } catch {
      // Translation table may not exist yet (migration not run); silently skip.
    }

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate'))
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    console.error('Content update error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** DELETE /api/admin/content/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { content, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [deleted] = await db.delete(content).where(eq(content.id, id)).returning({ id: content.id, title: content.title }).catch(() => []);
  if (!deleted) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'DELETE',
    entityType: 'Content',
    entityId: id,
    metadata: { title: deleted.title },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

/** POST /api/admin/content/[id] — approve | publish | archive */
export async function POST(request: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });

  const { action } = parsed.data;
  const { db } = await import('@/db');
  const { content, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db.select().from(content).where(eq(content.id, id)).limit(1).catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  let updates: Record<string, unknown> = {};

  if (action === 'approve') {
    updates = { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.adminId, updatedAt: new Date() };
  } else if (action === 'publish') {
    if (current.status !== 'APPROVED' && current.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Yalnızca onaylanmış içerik yayınlanabilir.' }, { status: 422 });
    }
    if (!current.approvedAt || !current.approvedBy) {
      return NextResponse.json({ error: 'Yayınlamak için önce onay gereklidir.' }, { status: 422 });
    }
    updates = { status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() };
  } else if (action === 'archive') {
    updates = { status: 'ARCHIVED', updatedAt: new Date() };
  }

  try {
    const [updated] = await db.update(content).set(updates).where(eq(content.id, id)).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: action.toUpperCase(),
      entityType: 'Content',
      entityId: id,
      metadata: { title: current.title, newStatus: updated.status },
    }).catch(() => {});

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('Content action error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
