import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const LOCATION_TYPES = ['AIRPORT', 'DISTRICT', 'REGION', 'HOTEL_ZONE', 'CUSTOM', 'PROVINCE'] as const;
const LOCATION_SCOPES = ['LOCAL', 'INTERCITY', 'BOTH'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Lokasyon adı gereklidir').max(200),
  slug: z
    .string()
    .min(1, 'Slug gereklidir')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir'),
  city: z.string().max(100).default('İstanbul'),
  district: z.string().max(200).optional().nullable(),
  type: z.enum(LOCATION_TYPES).default('DISTRICT'),
  scope: z.enum(LOCATION_SCOPES).default('LOCAL'),
  pickupEnabled: z.boolean().default(true),
  dropoffEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
}).refine(
  (d) => d.pickupEnabled || d.dropoffEnabled,
  { message: 'En az biri etkin olmalıdır: Alış veya Bırakış.' },
);

/** GET /admin/api/locations */
export async function GET(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const type = searchParams.get('type') ?? '';
  const scopeFilter = searchParams.get('scope') ?? '';
  const activeOnly = searchParams.get('active') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(300, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
  const offset = (page - 1) * limit;

  try {
    const { db } = await import('@/db');
    const { locations } = await import('@/db/schema');
    const { eq, asc, ilike, and, isNull, count } = await import('drizzle-orm');

    const conditions = [isNull(locations.archivedAt)];
    if (search) conditions.push(ilike(locations.name, `%${search}%`));
    if (type) conditions.push(eq(locations.type, type as typeof LOCATION_TYPES[number]));
    if (scopeFilter) conditions.push(eq(locations.scope, scopeFilter as typeof LOCATION_SCOPES[number]));
    if (activeOnly) conditions.push(eq(locations.isActive, true));

    const where = and(...conditions);

    const [items, totalRows] = await Promise.all([
      db.select().from(locations).where(where)
        .orderBy(asc(locations.displayOrder), asc(locations.name))
        .limit(limit).offset(offset),
      db.select({ count: count() }).from(locations).where(where),
    ]);

    return NextResponse.json({ items, total: totalRows[0]?.count ?? 0 });
  } catch (err) {
    console.error('Locations list error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** POST /admin/api/locations */
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

  const data = parsed.data;
  const { sanitizeText } = await import('@/lib/sanitize');

  try {
    const { db } = await import('@/db');
    const { locations, auditLogs } = await import('@/db/schema');

    const [newItem] = await db
      .insert(locations)
      .values({
        name: sanitizeText(data.name),
        slug: data.slug,
        city: sanitizeText(data.city),
        district: data.district ? sanitizeText(data.district) : null,
        type: data.type,
        scope: data.scope,
        pickupEnabled: data.pickupEnabled,
        dropoffEnabled: data.dropoffEnabled,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      })
      .returning();

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'Location',
      entityId: newItem.id,
      metadata: { name: newItem.name, type: newItem.type, scope: newItem.scope },
    }).catch(() => {});

    // Invalidate public locations cache
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/data/locations');

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('Location create error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
