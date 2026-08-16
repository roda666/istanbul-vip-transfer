/**
 * /admin/api/staff — Manage CHAT_STAFF accounts.
 * Only SUPER_ADMIN and ADMIN can create/list staff.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function requireManagerSession() {
  const { requireAdminSession } = await import('@/lib/auth/session');
  const session = await requireAdminSession();
  if (!ALLOWED_ROLES.includes(session.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return session;
}

export async function GET() {
  try { await requireManagerSession(); }
  catch (e: unknown) {
    const err = e as { status?: number };
    return NextResponse.json({ error: 'Unauthorized' }, { status: err.status ?? 401 });
  }

  try {
    const { db } = await import('@/db');
    const { adminUsers } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const rows = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        name: adminUsers.name,
        role: adminUsers.role,
        active: adminUsers.active,
        createdAt: adminUsers.createdAt,
        lastLoginAt: adminUsers.lastLoginAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.role, 'CHAT_STAFF'))
      .orderBy(desc(adminUsers.createdAt));

    return NextResponse.json({ staff: rows });
  } catch (err) {
    console.error('Staff GET error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireManagerSession(); }
  catch (e: unknown) {
    const err = e as { status?: number };
    return NextResponse.json({ error: 'Unauthorized' }, { status: err.status ?? 401 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json'))
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });

  const { name, email, password } = parsed.data;

  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { hashPassword } = await import('@/lib/auth/password');
    const { eq } = await import('drizzle-orm');

    // Check duplicate email
    const existing = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase())).limit(1);
    if (existing.length > 0)
      return NextResponse.json({ error: 'Bu e-posta adresi zaten kullanılıyor.' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const [created] = await db.insert(adminUsers).values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: 'CHAT_STAFF',
      active: true,
    }).returning({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      active: adminUsers.active,
      createdAt: adminUsers.createdAt,
    });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'AdminUser',
      entityId: created.id,
      metadata: { role: 'CHAT_STAFF', name },
    }).catch(() => {});

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (err) {
    console.error('Staff POST error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
