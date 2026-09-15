import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { ADMIN_GRANT_SECTION_KEYS } from '@/lib/auth/authorization';

async function requireSuperAdmin() {
  const { requireAdminSession } = await import('@/lib/auth/session');
  const session = await requireAdminSession();
  if (session.role !== 'SUPER_ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return session;
}
function authError(error: unknown) {
  const status = (error as { status?: number }).status ?? 401;
  return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
}
const grantSchema = z.object({
  section: z.enum(ADMIN_GRANT_SECTION_KEYS),
  canView: z.boolean().default(false),
  canManage: z.boolean().default(false),
});
const grantsSchema = z.array(grantSchema).max(18).superRefine((grants, ctx) => {
  if (new Set(grants.map((grant) => grant.section)).size !== grants.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bölüm izinleri tekrar edemez.' });
  }
});
const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  active: z.boolean().optional(),
  grants: grantsSchema.optional(),
}).strict();
interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  let session;
  try { session = await requireSuperAdmin(); } catch (error) { return authError(error); }
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { adminUsers, adminSectionGrants, auditLogs } = await import('@/db/schema');
    const { and, eq, ne } = await import('drizzle-orm');
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select({ id: adminUsers.id, name: adminUsers.name, active: adminUsers.active })
        .from(adminUsers).where(and(eq(adminUsers.id, id), ne(adminUsers.role, 'SUPER_ADMIN'))).limit(1);
      if (!before) throw Object.assign(new Error('Kullanıcı bulunamadı veya değiştirilemez.'), { status: 404 });
      const old = await tx.select({ section: adminSectionGrants.section, canView: adminSectionGrants.canView, canManage: adminSectionGrants.canManage })
        .from(adminSectionGrants).where(eq(adminSectionGrants.adminUserId, id));
      const next = parsed.data.grants?.map((grant) => ({ ...grant, canView: grant.canView || grant.canManage, adminUserId: id }));
      const identityChanged = parsed.data.name !== undefined && parsed.data.name !== before.name ||
        parsed.data.active !== undefined && parsed.data.active !== before.active;
      const grantChanged = next !== undefined && (
        old.length !== next.length || old.some((grant) => {
          const replacement = next.find((item) => item.section === grant.section);
          return !replacement || replacement.canView !== grant.canView || replacement.canManage !== grant.canManage;
        })
      );
      if (!identityChanged && !grantChanged) {
        const [current] = await tx.select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt })
          .from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
        return { current, old, next: undefined };
      }
      const [current] = await tx.update(adminUsers).set({
        ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
        ...(parsed.data.active === undefined ? {} : { active: parsed.data.active }),
        updatedAt: new Date(),
        sessionVersion: sql`${adminUsers.sessionVersion} + 1`,
      }).where(eq(adminUsers.id, id)).returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt });
      if (next !== undefined && grantChanged) {
        await tx.delete(adminSectionGrants).where(eq(adminSectionGrants.adminUserId, id));
        if (next.length) await tx.insert(adminSectionGrants).values(next);
        const oldBySection = new Map<string, { section: string; canView: boolean; canManage: boolean }>(
          old.map((grant) => [grant.section, grant]),
        );
        const nextBySection = new Map<string, { section: string; canView: boolean; canManage: boolean; adminUserId: string }>(
          next.map((grant) => [grant.section, grant]),
        );
        for (const section of new Set([...oldBySection.keys(), ...nextBySection.keys()])) {
          const prior = oldBySection.get(section) ?? { canView: false, canManage: false };
          const after = nextBySection.get(section) ?? { canView: false, canManage: false };
          if (prior.canView !== after.canView || prior.canManage !== after.canManage) {
            await tx.insert(auditLogs).values({
              adminUserId: session.adminId, action: 'GRANT_UPDATE', entityType: 'AdminUser', entityId: id,
              metadata: { actorId: session.adminId, targetId: id, section, before: { canView: prior.canView, canManage: prior.canManage }, after: { canView: after.canView, canManage: after.canManage } },
            });
          }
        }
      }
      if (identityChanged) {
        await tx.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'UPDATE', entityType: 'AdminUser', entityId: id,
          metadata: { actorId: session.adminId, targetId: id, nameChanged: parsed.data.name !== undefined, activeChanged: parsed.data.active !== undefined },
        });
      }
      return { current, old, next };
    });
    return NextResponse.json({ staff: updated.current });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status) return NextResponse.json({ error: (error as Error).message }, { status });
    console.error('Staff PATCH error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  let session;
  try { session = await requireSuperAdmin(); } catch (error) { return authError(error); }
  const { id } = await ctx.params;
  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { and, eq, ne } = await import('drizzle-orm');
    const deleted = await db.transaction(async (tx) => {
      const [row] = await tx.delete(adminUsers).where(and(eq(adminUsers.id, id), ne(adminUsers.role, 'SUPER_ADMIN'))).returning({ id: adminUsers.id });
      if (!row) throw Object.assign(new Error('Kullanıcı bulunamadı veya silinemez.'), { status: 404 });
      await tx.insert(auditLogs).values({ adminUserId: session.adminId, action: 'DELETE', entityType: 'AdminUser', entityId: id, metadata: { actorId: session.adminId, targetId: id } });
      return row;
    });
    return NextResponse.json({ success: !!deleted });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status) return NextResponse.json({ error: (error as Error).message }, { status });
    console.error('Staff DELETE error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}