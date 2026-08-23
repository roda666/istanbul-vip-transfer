import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VEHICLE_TYPE_VALUES } from '@/lib/vehicle-options';

const updateSchema = z.object({
  name: z.string().min(1, 'Araç adı gereklidir').max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir')
    .optional(),
  shortDescription: z.string().max(500).optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  passengerCapacity: z.number().int().min(1).max(99).optional().nullable(),
  luggageCapacity: z.number().int().min(0).max(99).optional().nullable(),
  vehicleType: z.enum(VEHICLE_TYPE_VALUES).optional().nullable(),
  features: z.array(z.string().max(200)).optional(),
  coverImage: z.string().max(500).optional().nullable(),
  coverImageAlt: z.string().max(300).optional().nullable(),
  gallery: z
    .array(z.object({ url: z.string().max(500), alt: z.string().max(300) }))
    .optional(),
  displayOrder: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
  // APPROVED and PUBLISHED only via action endpoint; ARCHIVED allowed here as soft-delete
  status: z.enum(['DRAFT', 'RESEARCH', 'REVIEW', 'ARCHIVED']).optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(400).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogImage: z.string().max(500).optional().nullable(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
});

const actionSchema = z.object({
  action: z.enum(['approve', 'publish', 'archive']),
});

type Params = { params: Promise<{ id: string }> };

/** GET /admin/api/vehicles/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { vehicles } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1).catch(() => []);
  if (!rows[0]) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });
  return NextResponse.json({ item: rows[0] });
}

/** PUT /admin/api/vehicles/[id] */
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );

  const data = parsed.data;

  // Cover image ALT requirement
  if (data.coverImage !== undefined && data.coverImage && !data.coverImageAlt) {
    return NextResponse.json(
      { error: 'Kapak görseli girildiğinde ALT metni zorunludur.' },
      { status: 422 },
    );
  }

  const { db } = await import('@/db');
  const { vehicles, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select({ id: vehicles.id, status: vehicles.status })
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
    .catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  const { getApprovalReset } = await import('@/lib/workflow');
  const { sanitizeText, sanitizeHtml } = await import('@/lib/sanitize');

  // Apply approval reset when editing APPROVED or SCHEDULED content
  const reset = getApprovalReset(current.status as Parameters<typeof getApprovalReset>[0]);
  const approvalFields = reset ?? {};

  try {
    const updateValues: Record<string, unknown> = {
      ...approvalFields,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    };

    if (data.name !== undefined) updateValues.name = sanitizeText(data.name);
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.shortDescription !== undefined)
      updateValues.shortDescription = data.shortDescription
        ? sanitizeText(data.shortDescription)
        : null;
    if (data.fullDescription !== undefined)
      updateValues.fullDescription = data.fullDescription
        ? sanitizeHtml(data.fullDescription)
        : null;
    if (data.passengerCapacity !== undefined) updateValues.passengerCapacity = data.passengerCapacity;
    if (data.luggageCapacity !== undefined) updateValues.luggageCapacity = data.luggageCapacity;
    if (data.vehicleType !== undefined)
      updateValues.vehicleType = data.vehicleType ? sanitizeText(data.vehicleType) : null;
    if (data.features !== undefined)
      updateValues.features = data.features.map((f) => sanitizeText(f));
    if (data.coverImage !== undefined)
      updateValues.coverImage = data.coverImage ? sanitizeText(data.coverImage) : null;
    if (data.coverImageAlt !== undefined)
      updateValues.coverImageAlt = data.coverImageAlt ? sanitizeText(data.coverImageAlt) : null;
    if (data.gallery !== undefined)
      updateValues.gallery = data.gallery.map((g) => ({
        url: sanitizeText(g.url),
        alt: sanitizeText(g.alt),
      }));
    if (data.displayOrder !== undefined) updateValues.displayOrder = data.displayOrder;
    if (data.isFeatured !== undefined) updateValues.isFeatured = data.isFeatured;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.metaTitle !== undefined)
      updateValues.metaTitle = data.metaTitle ? sanitizeText(data.metaTitle) : null;
    if (data.metaDescription !== undefined)
      updateValues.metaDescription = data.metaDescription
        ? sanitizeText(data.metaDescription)
        : null;
    if (data.canonicalUrl !== undefined)
      updateValues.canonicalUrl = data.canonicalUrl ? sanitizeText(data.canonicalUrl) : null;
    if (data.ogImage !== undefined)
      updateValues.ogImage = data.ogImage ? sanitizeText(data.ogImage) : null;
    if (data.robotsIndex !== undefined) updateValues.robotsIndex = data.robotsIndex;
    if (data.robotsFollow !== undefined) updateValues.robotsFollow = data.robotsFollow;

    const [updated] = await db
      .update(vehicles)
      .set(updateValues)
      .where(eq(vehicles.id, id))
      .returning();

    await db
      .insert(auditLogs)
      .values({
        adminUserId: session.adminId,
        action: 'UPDATE',
        entityType: 'Vehicle',
        entityId: id,
        metadata: { resetApproval: !!reset, newStatus: updated.status },
      })
      .catch(() => {});

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate'))
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    console.error('Vehicle update error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** DELETE /admin/api/vehicles/[id]
 *  Permanent delete is only allowed for never-published drafts (publishedAt IS NULL
 *  and status is DRAFT/RESEARCH/REVIEW). All other records must be archived via
 *  the POST action endpoint instead.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { db } = await import('@/db');
  const { vehicles, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select({ id: vehicles.id, name: vehicles.name, status: vehicles.status, publishedAt: vehicles.publishedAt })
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
    .catch(() => []);

  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  // Block permanent deletion if the vehicle was ever published
  if (current.publishedAt !== null) {
    return NextResponse.json(
      {
        error:
          'Yayınlanmış veya daha önce yayınlanmış araçlar kalıcı olarak silinemez. Lütfen arşivleyin.',
      },
      { status: 422 },
    );
  }

  // Also block if status is not a pre-approval state
  const deletableStatuses = ['DRAFT', 'RESEARCH', 'REVIEW'];
  if (!deletableStatuses.includes(current.status)) {
    return NextResponse.json(
      {
        error:
          'Yalnızca taslak veya incelemede olan araçlar kalıcı olarak silinebilir. Diğerleri için arşivleme kullanın.',
      },
      { status: 422 },
    );
  }

  await db.delete(vehicles).where(eq(vehicles.id, id));

  await db
    .insert(auditLogs)
    .values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'Vehicle',
      entityId: id,
      metadata: { name: current.name },
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}

/** POST /admin/api/vehicles/[id] — approve | publish | archive */
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });

  const { action } = parsed.data;

  // Approve requires at least ADMIN role
  if (action === 'approve') {
    if (session.role === 'EDITOR') {
      return NextResponse.json({ error: 'Onay işlemi için yetkiniz yok.' }, { status: 403 });
    }
  }

  const { db } = await import('@/db');
  const { vehicles, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [current] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
    .catch(() => []);
  if (!current) return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 });

  let updates: Record<string, unknown> = {};

  if (action === 'approve') {
    updates = {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: session.adminId,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    };
  } else if (action === 'publish') {
    if (current.status !== 'APPROVED' && current.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Yalnızca onaylanmış araçlar yayınlanabilir.' },
        { status: 422 },
      );
    }
    if (!current.approvedAt || !current.approvedBy) {
      return NextResponse.json(
        { error: 'Yayınlamak için önce onay gereklidir.' },
        { status: 422 },
      );
    }
    if (
      !current.coverImage?.trim()
      || !current.coverImageAlt?.trim()
      || !current.vehicleType
      || !VEHICLE_TYPE_VALUES.includes(current.vehicleType as (typeof VEHICLE_TYPE_VALUES)[number])
      || !current.passengerCapacity
      || current.passengerCapacity < 1
      || current.luggageCapacity === null
      || current.luggageCapacity < 0
    ) {
      return NextResponse.json(
        { error: 'Yayınlamak için geçerli araç tipi, yolcu/bagaj kapasitesi ve kapak görseli ile ALT metni gereklidir.' },
        { status: 422 },
      );
    }
    const { and, eq, ne } = await import('drizzle-orm');
    const duplicateCover = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(
        eq(vehicles.coverImage, current.coverImage),
        eq(vehicles.status, 'PUBLISHED'),
        ne(vehicles.id, id),
      ))
      .limit(1);
    if (duplicateCover.length > 0) {
      return NextResponse.json(
        { error: 'Yayınlanan her araç için başka bir kayıtta kullanılmayan benzersiz bir kapak görseli gereklidir.' },
        { status: 422 },
      );
    }
    updates = {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: session.adminId,
    };
  } else if (action === 'archive') {
    updates = {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: session.adminId,
    };
  }

  try {
    const [updated] = await db
      .update(vehicles)
      .set(updates)
      .where(eq(vehicles.id, id))
      .returning();

    await db
      .insert(auditLogs)
      .values({
        adminUserId: session.adminId,
        action: action.toUpperCase(),
        entityType: 'Vehicle',
        entityId: id,
        metadata: { name: current.name, newStatus: updated.status },
      })
      .catch(() => {});

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error('Vehicle action error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
