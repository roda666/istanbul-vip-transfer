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

export async function POST(request: NextRequest) {
  // CSRF
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = rateLimit(`${ip}:email-test-conn`);
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

  // Load config from DB
  try {
    const { db }            = await import('@/db');
    const { emailSettings } = await import('@/db/schema');
    const rows = await db.select().from(emailSettings).limit(1);
    const row  = rows[0];

    if (!row?.smtpHost || !row?.smtpUser) {
      return NextResponse.json({ error: 'SMTP sunucu adresi ve kullanıcı adı gereklidir.' }, { status: 422 });
    }

    let pass = '';
    if (row.smtpPassEncrypted) {
      const { decrypt } = await import('@/lib/email-crypto');
      pass = decrypt(row.smtpPassEncrypted) ?? '';
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   row.smtpHost,
      port:   row.smtpPort ?? 587,
      secure: row.smtpSecure === 'ssl',
      auth:   { user: row.smtpUser, pass },
      connectionTimeout: 8000,
      greetingTimeout:   8000,
      socketTimeout:     8000,
    });

    await transporter.verify();

    // Audit log
    const { auditLogs } = await import('@/db/schema');
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action:      'EMAIL_CONNECTION_TESTED',
      entityType:  'EmailSettings',
      entityId:    '1',
      metadata:    { ip, result: 'success' },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'SMTP bağlantısı başarılı.' });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'SMTP sunucusuna bağlanılamadı. Sunucu adresi, port ve kimlik bilgilerini kontrol edin.',
    }, { status: 400 });
  }
}
