/** Personnel and per-domain grant management (SUPER_ADMIN only). */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
const grantsSchema = z.array(grantSchema).max(18).default([]).superRefine((grants, ctx) => {
  if (new Set(grants.map((grant) => grant.section)).size !== grants.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bölüm izinleri tekrar edemez.' });
  }
});
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  grants: grantsSchema,
}).strict();

export async function GET() {
  try { await requireSuperAdmin(); } catch (error) { return authError(error); }
  try {
    const { db } = await import('@/db');
    const { adminUsers, adminSectionGrants } = await import('@/db/schema');
    const { ne, desc } = await import('drizzle-orm');
    const users = await db.select({
      id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role,
      active: adminUsers.active, createdAt: adminUsers.createdAt, lastLoginAt: adminUsers.lastLoginAt,
    }).from(adminUsers).where(ne(adminUsers.role, 'SUPER_ADMIN')).orderBy(desc(adminUsers.createdAt));
    const allGrants = await db.select({
      adminUserId: adminSectionGrants.adminUserId, section: adminSectionGrants.section,
      canView: adminSectionGrants.canView, canManage: adminSectionGrants.canManage,
    }).from(adminSectionGrants);
    return NextResponse.json({ staff: users.map((user) => ({
      ...user,
      grants: allGrants.filter((grant) => grant.adminUserId === user.id)
        .map((grant) => ({
          section: grant.section,
          canView: grant.canView,
          canManage: grant.canManage,
        })),
    })) });
  } catch (error) {
    console.error('Staff GET error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireSuperAdmin(); } catch (error) { return authError(error); }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  try {
    const { db } = await import('@/db');
    const { adminUsers, adminSectionGrants, auditLogs } = await import('@/db/schema');
    const { hashPassword } = await import('@/lib/auth/password');
    const { eq } = await import('drizzle-orm');
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: adminUsers.id }).from(adminUsers)
        .where(eq(adminUsers.email, parsed.data.email.toLowerCase())).limit(1);
      if (existing.length) throw Object.assign(new Error('Bu e-posta adresi zaten kullanılıyor.'), { status: 409 });
      const [user] = await tx.insert(adminUsers).values({
        email: parsed.data.email.toLowerCase(), passwordHash: await hashPassword(parsed.data.password),
        name: parsed.data.name, role: 'CHAT_STAFF', active: true,
      }).returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt });
      const grants = parsed.data.grants.map((grant) => ({ ...grant, canView: grant.canView || grant.canManage, adminUserId: user.id }));
      if (grants.length) await tx.insert(adminSectionGrants).values(grants);
      for (const grant of grants) {
        await tx.insert(auditLogs).values({
          adminUserId: session.adminId, action: 'GRANT_UPDATE', entityType: 'AdminUser', entityId: user.id,
          metadata: {
            actorId: session.adminId, targetId: user.id, section: grant.section,
            before: { canView: false, canManage: false },
            after: { canView: grant.canView, canManage: grant.canManage },
          },
        });
      }
      await tx.insert(auditLogs).values({ adminUserId: session.adminId, action: 'CREATE', entityType: 'AdminUser', entityId: user.id, metadata: { actorId: session.adminId, targetId: user.id } });
      return {
        ...user,
        grants: grants.map((grant) => ({
          section: grant.section,
          canView: grant.canView,
          canManage: grant.canManage,
        })),
      };
    });
    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    if ((error as { status?: number }).status === 409) return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    console.error('Staff POST error:', error);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}