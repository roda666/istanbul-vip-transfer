/**
 * /admin/api/staff/[id] — Toggle active status or delete a CHAT_STAFF account.
 */
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function requireManagerSession() {
  const { requireAdminSession } = await import('@/lib/auth/session');
  const session = await requireAdminSession();
  if (!ALLOWED_ROLES.includes(session.role))
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  return session;
}

interface Ctx { params: Promise<{ id: string }> }

/** PATCH — toggle active status */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  let session;
  try { session = await requireManagerSession(); }
  catch (e: unknown) {
    const err = e as { status?: number };
    return NextResponse.json({ error: 'Unauthorized' }, { status: err.status ?? 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const active = (body as { active?: unknown }).active;
  if (typeof active !== 'boolean')
    return NextResponse.json({ error: 'active boolean gereklidir.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const [updated] = await db.update(adminUsers)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(adminUsers.id, id), eq(adminUsers.role, 'CHAT_STAFF')))
      .returning({ id: adminUsers.id, active: adminUsers.active });

    if (!updated)
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'UPDATE',
      entityType: 'AdminUser',
      entityId: id,
      metadata: { active },
    }).catch(() => {});

    return NextResponse.json({ staff: updated });
  } catch (err) {
    console.error('Staff PATCH error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

/** DELETE — permanently remove a CHAT_STAFF account */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  let session;
  try { session = await requireManagerSession(); }
  catch (e: unknown) {
    const err = e as { status?: number };
    return NextResponse.json({ error: 'Unauthorized' }, { status: err.status ?? 401 });
  }

  const { id } = await ctx.params;

  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    // Safety: only delete CHAT_STAFF roles
    const [deleted] = await db.delete(adminUsers)
      .where(and(eq(adminUsers.id, id), eq(adminUsers.role, 'CHAT_STAFF')))
      .returning({ id: adminUsers.id, name: adminUsers.name });

    if (!deleted)
      return NextResponse.json({ error: 'Kullanıcı bulunamadı veya silinemez.' }, { status: 404 });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'AdminUser',
      entityId: id,
      metadata: { name: deleted.name },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Staff DELETE error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
