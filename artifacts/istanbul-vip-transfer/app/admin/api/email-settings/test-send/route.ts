/**
 * POST /admin/api/email-settings/test-send
 *
 * Sends a single test email to the explicitly provided recipient address.
 * Only that one address receives the message — no bulk, no BCC.
 * SUPER_ADMIN only. Rate limited: 3 req / 15 min per IP.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { sendEmail } from '@/lib/email';

const bodySchema = z.object({
  to: z.string().email('Geçerli bir e-posta adresi girin.').max(320),
});

export async function POST(request: NextRequest) {
  // CSRF
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Rate limit — more conservative for actual sends
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = await rateLimit(`${ip}:email-test-send`);
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

  // Parse recipient
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { to } = parsed.data;

  const delivered = await sendEmail({
    to,
    subject: 'VIP Transfer — E-posta Testi',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#172B3A;">
        <h2 style="color:#C99A32;margin:0 0 12px;">Test E-postası</h2>
        <p>Bu mesaj Istanbul VIP Transfer admin panelinden gönderilmiştir.</p>
        <p>SMTP yapılandırmanız <strong>çalışıyor</strong>.</p>
        <hr style="border:none;border-top:1px solid #E5EBF0;margin:20px 0;"/>
        <p style="font-size:12px;color:#8899AA;">Gönderen: ${session.name} (${session.email})</p>
      </div>`,
    text: 'Test E-postası — Istanbul VIP Transfer SMTP yapılandırmanız çalışıyor.',
  });

  if (!delivered) {
    return NextResponse.json({
      success: false,
      error: 'E-posta gönderilemedi. SMTP ayarlarını ve alıcı adresini kontrol edin.',
    }, { status: 400 });
  }

  // Audit log
  const { db }         = await import('@/db');
  const { auditLogs }  = await import('@/db/schema');
  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action:      'EMAIL_TEST_SENT',
    entityType:  'EmailSettings',
    entityId:    '1',
    metadata:    { ip, to },
  }).catch(() => {});

  return NextResponse.json({ success: true, message: `Test e-postası ${to} adresine gönderildi.` });
}
