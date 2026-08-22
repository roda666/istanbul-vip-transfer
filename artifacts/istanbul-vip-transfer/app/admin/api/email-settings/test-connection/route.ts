/**
 * POST /admin/api/email-settings/test-connection
 *
 * Verifies that the current SMTP settings can establish a connection.
 * Does NOT send any email.
 * SUPER_ADMIN only. Rate limited: 5 req / 15 min per IP.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { verifySmtpConnection } from '@/lib/email';

export async function POST(request: NextRequest) {
  // CSRF
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = await rateLimit(`${ip}:email-test-conn`);
  if (!rl.success) {
    const m = Math.ceil(rl.retryAfterSeconds / 60);
    return NextResponse.json({ error: `Çok fazla deneme. ${m} dakika bekleyin.` }, { status: 429 });
  }

  // Auth
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  }

  const result = await verifySmtpConnection();
  if (result.ok) {
    try {
      const { db } = await import('@/db');
      const { auditLogs } = await import('@/db/schema');

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action:      'EMAIL_CONNECTION_TESTED',
        entityType:  'EmailSettings',
        entityId:    '1',
        metadata:    { ip, result: result.code },
      }).catch(() => {});
    } catch {
      // A connection result must remain accurate even if audit storage is unavailable.
    }

    return NextResponse.json({ success: true, message: result.message, connection: { code: result.code } });
  }

  return NextResponse.json({
    success: false,
    error: result.message,
    connection: { code: result.code },
  }, { status: 400 });
}
