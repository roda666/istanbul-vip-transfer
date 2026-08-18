/**
 * POST /admin/api/auth/reset-password
 * Request a password reset link. Sends an email with a secure token.
 * Rate limited: 3 requests per 15 minutes per IP.
 * Always returns the same message (prevents email enumeration).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory rate limit: 3 requests per 15 min per IP
const resetAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const WINDOW = 15 * 60 * 1000;
  const MAX = 3;

  const entry = resetAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    resetAttempts.set(ip, { count: 1, resetAt: now + WINDOW });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

const OK_MSG = { message: 'Eğer bu e-posta adresi sistemde kayıtlıysa, sıfırlama linki gönderildi.' };

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Çok fazla istek. Lütfen ${minutes} dakika bekleyin.` },
      { status: 429 },
    );
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json(OK_MSG);
  } catch {
    return NextResponse.json(OK_MSG);
  }

  try {
    const { db }        = await import('@/db');
    const { adminUsers } = await import('@/db/schema');
    const { eq }        = await import('drizzle-orm');

    const rows = await db
      .select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, active: adminUsers.active })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    const user = rows[0];
    if (!user || !user.active) return NextResponse.json(OK_MSG); // silent — no enumeration

    // Generate a secure single-use token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing unused tokens for this user first
    await db.execute(
      `DELETE FROM password_reset_tokens WHERE admin_user_id = '${user.id}' AND used_at IS NULL` as never,
    );

    // Insert new token
    await db.execute(
      `INSERT INTO password_reset_tokens (admin_user_id, token, expires_at)
       VALUES ('${user.id}', '${token}', '${expiresAt.toISOString()}')` as never,
    );

    // Build reset URL — works both in dev and production
    const origin = req.headers.get('x-forwarded-host')
      ? `https://${req.headers.get('x-forwarded-host')}`
      : new URL(req.url).origin;
    const resetUrl = `${origin}/admin/login/reset-password?token=${token}`;

    // Send email
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({
      to: user.email,
      subject: 'Admin Şifre Sıfırlama — İstanbul VIP Transfer',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F8FAFC;border-radius:12px;">
          <h2 style="color:#1B2B4B;margin:0 0 16px;">Şifre Sıfırlama</h2>
          <p style="color:#334155;line-height:1.6;">Merhaba ${user.name},</p>
          <p style="color:#334155;line-height:1.6;">Admin paneli şifrenizi sıfırlamak için aşağıdaki butona tıklayın. Bu link <strong>1 saat</strong> geçerlidir ve yalnızca bir kez kullanılabilir.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#1B2B4B;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
              Şifremi Sıfırla
            </a>
          </div>
          <p style="color:#64748B;font-size:13px;line-height:1.6;">Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın. Şifreniz değişmeyecektir.</p>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">
          <p style="color:#94A3B8;font-size:12px;">İstanbul VIP Transfer Admin Paneli</p>
        </div>
      `,
      text: `Şifre Sıfırlama\n\nMerhaba ${user.name},\n\nŞifrenizi sıfırlamak için şu linke gidin (1 saat geçerli):\n${resetUrl}\n\nBu isteği siz yapmadıysanız dikkate almayın.`,
    });
  } catch (err) {
    // Log but don't expose to client
    console.error('[reset-password] Error:', err instanceof Error ? err.message : 'unknown');
  }

  // Always return same response
  return NextResponse.json(OK_MSG);
}
