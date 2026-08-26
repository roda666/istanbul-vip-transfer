import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VEHICLE_TYPE_VALUES } from '@/lib/vehicle-options';
import { vehicleTollPointClassInputSchema } from '@/lib/toll-input';

const createSchema = z.object({
  name: z.string().min(1, 'Araç adı gereklidir').max(200),
  slug: z
    .string()
    .min(1, 'Slug gereklidir')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir'),
  shortDescription: z.string().max(500).optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  passengerCapacity: z.number().int().min(1).max(99).optional().nullable(),
  luggageCapacity: z.number().int().min(0).max(99).optional().nullable(),
  vehicleType: z.enum(VEHICLE_TYPE_VALUES).optional().nullable(),
  priceCalculationEligible: z.boolean().default(false),
  pricingClass: z.enum(['minivan', 'minibus', 'midibus', 'bus']).default('minivan'),
  // Official toll class is assigned per toll point (never a single global
  // value), since different operators can classify vehicles differently.
  // Never guessed by the system: omitted points stay "not yet assigned".
  tollPointClasses: z.array(vehicleTollPointClassInputSchema).max(50).default([]),
  isActive: z.boolean().default(true),
  features: z.array(z.string().max(200)).default([]),
  coverImage: z.string().max(500).optional().nullable(),
  coverImageAlt: z.string().max(300).optional().nullable(),
  gallery: z
    .array(z.object({ url: z.string().max(500), alt: z.string().max(300) }))
    .default([]),
  displayOrder: z.number().int().min(0).default(0),
  isFeatured: z.boolean().default(false),
  // Only DRAFT or REVIEW on create — no APPROVED/PUBLISHED/ARCHIVED
  status: z.enum(['DRAFT', 'REVIEW']).default('DRAFT'),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(400).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogImage: z.string().max(500).optional().nullable(),
  robotsIndex: z.boolean().optional().default(true),
  robotsFollow: z.boolean().optional().default(true),
});

const REQUEST_ONLY_SLUGS = new Set(['mercedes-e-class', 'mercedes-s-class', 'mercedes-v-class']);

/** GET /admin/api/vehicles */
export async function GET(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const status = searchParams.get('status') ?? '';
  const sort = searchParams.get('sort') === 'displayOrder' ? 'displayOrder' : 'updatedAt';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    const { db } = await import('@/db');
    const { vehicles } = await import('@/db/schema');
    const { eq, desc, asc, ilike, and, count } = await import('drizzle-orm');

    const conditions = [];
    if (search) conditions.push(ilike(vehicles.name, `%${search}%`));
    if (status) conditions.push(eq(vehicles.status, status as 'DRAFT' | 'RESEARCH' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      sort === 'displayOrder'
        ? order === 'asc'
          ? asc(vehicles.displayOrder)
          : desc(vehicles.displayOrder)
        : order === 'asc'
          ? asc(vehicles.updatedAt)
          : desc(vehicles.updatedAt);

    const [items, totalRows] = await Promise.all([
      db.select().from(vehicles).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ count: count() }).from(vehicles).where(where),
    ]);

    return NextResponse.json({ items, total: totalRows[0]?.count ?? 0 });
  } catch (err) {
    console.error('Vehicles list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /admin/api/vehicles */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  // Validate cover image ALT requirement
  if (parsed.data.coverImage && !parsed.data.coverImageAlt) {
    return NextResponse.json(
      { error: 'Kapak görseli girildiğinde ALT metni zorunludur.' },
      { status: 422 },
    );
  }

  const data = parsed.data;
  if (REQUEST_ONLY_SLUGS.has(data.slug) && data.priceCalculationEligible) {
    return NextResponse.json(
      { error: 'Bu araç yalnızca talep üzerine sunulur ve otomatik fiyat hesaplamasına eklenemez.' },
      { status: 422 },
    );
  }
  const { sanitizeText, sanitizeHtml } = await import('@/lib/sanitize');

  try {
    const { db } = await import('@/db');
    const { vehicles, auditLogs } = await import('@/db/schema');

    const [newItem] = await db
      .insert(vehicles)
      .values({
        name: sanitizeText(data.name),
        slug: data.slug,
        shortDescription: data.shortDescription ? sanitizeText(data.shortDescription) : null,
        fullDescription: data.fullDescription ? sanitizeHtml(data.fullDescription) : null,
        passengerCapacity: data.passengerCapacity ?? null,
        luggageCapacity: data.luggageCapacity ?? null,
        vehicleType: data.vehicleType ? sanitizeText(data.vehicleType) : null,
        priceCalculationEligible: data.priceCalculationEligible,
        pricingClass: data.pricingClass,
        isActive: data.isActive,
        features: data.features.map((f) => sanitizeText(f)),
        coverImage: data.coverImage ? sanitizeText(data.coverImage) : null,
        coverImageAlt: data.coverImageAlt ? sanitizeText(data.coverImageAlt) : null,
        gallery: data.gallery.map((g) => ({
          url: sanitizeText(g.url),
          alt: sanitizeText(g.alt),
        })),
        displayOrder: data.displayOrder,
        isFeatured: data.isFeatured,
        status: data.status,
        metaTitle: data.metaTitle ? sanitizeText(data.metaTitle) : null,
        metaDescription: data.metaDescription ? sanitizeText(data.metaDescription) : null,
        canonicalUrl: data.canonicalUrl ? sanitizeText(data.canonicalUrl) : null,
        ogImage: data.ogImage ? sanitizeText(data.ogImage) : null,
        robotsIndex: data.robotsIndex ?? true,
        robotsFollow: data.robotsFollow ?? true,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      })
      .returning();

    if (data.tollPointClasses.length) {
      const { vehicleTollPointClasses } = await import('@/db/schema');
      await db.insert(vehicleTollPointClasses).values(
        data.tollPointClasses.map((entry) => ({
          vehicleId: newItem.id,
          tollPointId: entry.tollPointId,
          vehicleClass: entry.vehicleClass,
          createdBy: session.adminId,
          updatedBy: session.adminId,
        })),
      );
    }

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'Vehicle',
      entityId: newItem.id,
      metadata: { name: newItem.name, status: newItem.status },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('Vehicle create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
