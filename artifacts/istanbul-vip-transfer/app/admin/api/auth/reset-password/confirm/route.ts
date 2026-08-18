/**
 * POST /admin/api/auth/reset-password/confirm
 * Verify a password reset token and set a new password.
 * Token is single-use and expires in 1 hour.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let token: string;
  let newPassword: string;

  try {
    const body = await req.json();
    token       = (body?.token       ?? '').trim();
    newPassword =  body?.password    ?? '';
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  if (!token || token.length < 32) {
    return NextResponse.json(
      { error: 'Geçersiz veya süresi dolmuş sıfırlama linki.' },
      { status: 400 },
    );
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Şifre en az 8 karakter olmalıdır.' },
      { status: 400 },
    );
  }

  try {
    const { db } = await import('@/db');

    // Escape token for raw SQL (it's hex so safe, but let's be explicit)
    const safeToken = token.replace(/[^a-f0-9]/g, '');
    if (safeToken.length < 32) {
      return NextResponse.json({ error: 'Geçersiz sıfırlama linki.' }, { status: 400 });
    }

    // Look up the token
    const rows = await db.execute(
      `SELECT id, admin_user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token = '${safeToken}'
       LIMIT 1` as never,
    ) as unknown as Array<{
      id: string;
      admin_user_id: string;
      expires_at: string;
      used_at:     string | null;
    }>;

    const record = rows[0];

    if (!record) {
      return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş sıfırlama linki.' }, { status: 400 });
    }
    if (record.used_at) {
      return NextResponse.json({ error: 'Bu sıfırlama linki zaten kullanılmış.' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Sıfırlama linkinin süresi dolmuş. Lütfen yeni bir link talep edin.' },
        { status: 400 },
      );
    }

    // Hash the new password
    const { hashPassword } = await import('@/lib/auth/password');
    const newHash = await hashPassword(newPassword);

    // Escape hash for SQL (bcrypt output contains only safe chars: $, ., /, 0-9, A-Z, a-z)
    const safeHash = newHash.replace(/'/g, "''");

    // Update password + bump sessionVersion atomically (invalidates all active sessions)
    await db.execute(
      `UPDATE admin_users
       SET password_hash    = '${safeHash}',
           session_version  = session_version + 1,
           updated_at       = NOW()
       WHERE id = '${record.admin_user_id}'` as never,
    );

    // Mark token as used (single-use enforcement)
    await db.execute(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = '${record.id}'` as never,
    );

    // Best-effort audit log
    try {
      await db.execute(
        `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, created_at)
         VALUES ('${record.admin_user_id}', 'PASSWORD_RESET', 'AdminUser', '${record.admin_user_id}', NOW())` as never,
      );
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password/confirm]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Sunucu hatası. Lütfen tekrar deneyin.' }, { status: 500 });
  }
}
