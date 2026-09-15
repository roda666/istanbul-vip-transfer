import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface Ctx { params: Promise<{ id: string }> }
const schema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: NextRequest, ctx: Ctx) {
  let session;
  try {
    const { requireAdminSession } = await import('@/lib/auth/session');
    session = await requireAdminSession();
    if (session.role !== 'SUPER_ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 401;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Şifre en az 8 karakter olmalıdır.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { hashPassword } = await import('@/lib/auth/password');
    const { and, eq, ne, sql } = await import('drizzle-orm');
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(adminUsers).set({
        passwordHash: await hashPassword(parsed.data.password),
        sessionVersion: sql`${adminUsers.sessionVersion} + 1`,
        updatedAt: new Date(),
      }).where(and(eq(adminUsers.id, id), ne(adminUsers.role, 'SUPER_ADMIN'))).returning({ id: adminUsers.id });
      if (!row) throw Object.assign(new Error('Kullanıcı bulunamadı veya değiştirilemez.'), { status: 404 });
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId, action: 'PASSWORD_RESET', entityType: 'AdminUser', entityId: id,
        metadata: { actorId: session.adminId, targetId: id },
      });
      return row;
    });
    if (!updated) return NextResponse.json({ error: 'Kullanıcı bulunamadı veya değiştirilemez.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Staff password reset error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}