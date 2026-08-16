import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, clearRateLimit } from '@/lib/auth/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifre gereklidir.'),
});

export async function POST(request: NextRequest) {
  // Require JSON body (CSRF protection — cross-origin forms can't send application/json)
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // IP-based rate limiting: max 5 attempts per 15 minutes
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const limit = rateLimit(ip);
  if (!limit.success) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Çok fazla başarısız deneme. Lütfen ${minutes} dakika bekleyin.` },
      { status: 429 },
    );
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Geçersiz giriş.' },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  // Check AUTH_SECRET availability
  const { tryBuildSessionOptions } = await import('@/lib/auth/session');
  const sessionOptions = tryBuildSessionOptions();
  if (!sessionOptions) {
    return NextResponse.json(
      { error: 'Sunucu yapılandırma hatası: AUTH_SECRET ayarlanmamış. ADMIN_SETUP.md dosyasına bakın.' },
      { status: 503 },
    );
  }

  // Look up the user
  let user: { id: string; passwordHash: string; name: string; role: string; active: boolean; sessionVersion: number } | undefined;
  try {
    const { db } = await import('@/db');
    const { adminUsers } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const rows = await db
      .select({
        id: adminUsers.id,
        passwordHash: adminUsers.passwordHash,
        name: adminUsers.name,
        role: adminUsers.role,
        active: adminUsers.active,
        sessionVersion: adminUsers.sessionVersion,
      })
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase()))
      .limit(1);

    user = rows[0];
  } catch {
    return NextResponse.json(
      { error: 'Veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.' },
      { status: 503 },
    );
  }

  // Verify credentials — use constant-time comparison
  const { verifyPassword } = await import('@/lib/auth/password');

  // Always run verifyPassword even if user not found (prevents timing attacks)
  const dummyHash = '$2b$12$dummy.hash.for.timing.attack.prevention.only.not.real';
  const passwordValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummyHash).then(() => false);

  if (!user || !passwordValid || !user.active) {
    return NextResponse.json(
      { error: 'E-posta veya şifre hatalı.' },
      { status: 401 },
    );
  }

  // Clear rate limit on success
  clearRateLimit(ip);

  // Set session
  const { cookies } = await import('next/headers');
  const { getIronSession } = await import('iron-session');
  const cookieStore = await cookies();
  const session = await getIronSession<{
    adminId: string; email: string; role: string; name: string;
    isLoggedIn: boolean; sessionVersion: number;
  }>(cookieStore, sessionOptions);

  session.adminId = user.id;
  session.email = email.toLowerCase();
  session.role = user.role;
  session.name = user.name;
  session.isLoggedIn = true;
  session.sessionVersion = user.sessionVersion;
  await session.save();

  // Update lastLoginAt and write audit log (best-effort)
  try {
    const { db } = await import('@/db');
    const { adminUsers, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await Promise.all([
      db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id)),
      db.insert(auditLogs).values({
        adminUserId: user.id,
        action: 'LOGIN',
        entityType: 'AdminUser',
        entityId: user.id,
        metadata: { ip },
      }),
    ]);
  } catch {
    // Non-fatal — don't fail login over audit logging
  }

  // CHAT_STAFF can only access the live-chat panel
  const redirectTo = user.role === 'CHAT_STAFF' ? '/admin/sohbet' : '/admin/dashboard';
  return NextResponse.json({ success: true, redirectTo });
}
