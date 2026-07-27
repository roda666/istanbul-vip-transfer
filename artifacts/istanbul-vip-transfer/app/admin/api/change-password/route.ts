import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/auth/rate-limit';
import { requireAdminSession } from '@/lib/auth/session';

const schema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gereklidir.'),
  newPassword: z
    .string()
    .min(8, 'Yeni şifre en az 8 karakter olmalıdır.')
    .max(128, 'Yeni şifre çok uzun.'),
  confirmPassword: z.string().min(1, 'Şifre tekrarı gereklidir.'),
});

export async function POST(request: NextRequest) {
  // CSRF: require JSON Content-Type
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Rate limit by IP (separate key from login attempts)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const limit = rateLimit(`${ip}:change-password`);
  if (!limit.success) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Çok fazla deneme. Lütfen ${minutes} dakika bekleyin.` },
      { status: 429 },
    );
  }

  // Authenticate from session only — never accept user ID from the request body
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  // Client-side validates too, but enforce server-side as well
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Yeni şifreler eşleşmiyor.' }, { status: 422 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'Yeni şifre mevcut şifreden farklı olmalıdır.' },
      { status: 422 },
    );
  }

  // Load the admin record identified solely by the authenticated session
  const { db } = await import('@/db');
  const { adminUsers, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [user] = await db
    .select({
      id: adminUsers.id,
      passwordHash: adminUsers.passwordHash,
      active: adminUsers.active,
      sessionVersion: adminUsers.sessionVersion,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, session.adminId))
    .limit(1)
    .catch(() => []);

  if (!user || !user.active) {
    return NextResponse.json({ error: 'Hesap bulunamadı veya devre dışı.' }, { status: 403 });
  }

  // Verify current password
  const { verifyPassword, hashPassword } = await import('@/lib/auth/password');
  const currentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentValid) {
    return NextResponse.json({ error: 'Mevcut şifre hatalı.' }, { status: 401 });
  }

  // Hash new password and increment sessionVersion to invalidate all other sessions
  const newHash = await hashPassword(newPassword);
  const newSessionVersion = user.sessionVersion + 1;

  await db
    .update(adminUsers)
    .set({
      passwordHash: newHash,
      sessionVersion: newSessionVersion,
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.id, user.id));

  // Audit log — no passwords or hashes
  await db
    .insert(auditLogs)
    .values({
      adminUserId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'AdminUser',
      entityId: user.id,
      metadata: { ip },
    })
    .catch(() => {});

  // Destroy the current session (other sessions are invalidated via sessionVersion check in layout)
  const { getSession } = await import('@/lib/auth/session');
  const ironSession = await getSession();
  ironSession.destroy();

  return NextResponse.json({ success: true });
}
