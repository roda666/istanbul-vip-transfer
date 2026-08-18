/**
 * GET  /admin/api/email-settings — current config (password NEVER returned)
 * PUT  /admin/api/email-settings — save config, encrypt password if provided
 *
 * SUPER_ADMIN only.
 * CSRF: JSON Content-Type required on PUT.
 * Rate limit: 10 req / 15 min per IP.
 * Audit log: every successful save.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { isEncryptionReady, encrypt } from '@/lib/email-crypto';

const putSchema = z.object({
  enabled:           z.boolean(),
  providerType:      z.enum(['gmail', 'sendgrid', 'mailgun', 'custom']),
  smtpHost:          z.string().max(253).optional().nullable(),
  smtpPort:          z.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure:        z.enum(['tls', 'ssl', 'none']),
  smtpUser:          z.string().max(320).optional().nullable(),
  /**
   * Empty / omitted → keep existing password untouched.
   * Non-empty string → encrypt and store.
   * Actual value is NEVER echoed back.
   */
  smtpPass:          z.string().max(512).optional().nullable(),
  fromName:          z.string().max(100).optional().nullable(),
  fromEmail:         z.string().email().max(320).optional().nullable(),
  replyToEmail:      z.string().email().max(320).optional().nullable(),
  adminNotifyEmails: z.string().max(1000).optional().nullable(),
});

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  }

  const encryptionReady = isEncryptionReady();

  try {
    const { db }           = await import('@/db');
    const { emailSettings } = await import('@/db/schema');
    const rows = await db.select().from(emailSettings).limit(1);
    const row  = rows[0];

    if (!row) {
      return NextResponse.json({
        encryptionReady,
        enabled: false, providerType: 'custom',
        smtpHost: null, smtpPort: 587, smtpSecure: 'tls',
        smtpUser: null, passwordSet: false,
        fromName: null, fromEmail: null, replyToEmail: null, adminNotifyEmails: null,
      });
    }

    return NextResponse.json({
      encryptionReady,
      enabled:           row.enabled,
      providerType:      row.providerType,
      smtpHost:          row.smtpHost,
      smtpPort:          row.smtpPort,
      smtpSecure:        row.smtpSecure,
      smtpUser:          row.smtpUser,
      passwordSet:       !!row.smtpPassEncrypted, // true → "kayıtlı"; actual value never sent
      fromName:          row.fromName,
      fromEmail:         row.fromEmail,
      replyToEmail:      row.replyToEmail,
      adminNotifyEmails: row.adminNotifyEmails,
    });
  } catch {
    return NextResponse.json({ error: 'Ayarlar yüklenemedi.' }, { status: 500 });
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  // CSRF
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = await rateLimit(`${ip}:email-settings`);
  if (!rl.success) {
    const m = Math.ceil(rl.retryAfterSeconds / 60);
    return NextResponse.json({ error: `Çok fazla deneme. ${m} dakika bekleyin.` }, { status: 429 });
  }

  // Auth — SUPER_ADMIN only
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 }); }
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  }

  // Parse body
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 }); }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' },
      { status: 422 },
    );
  }

  const data = parsed.data;

  // Determine what to store for the password
  const { db } = await import('@/db');
  const { emailSettings, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  // Read existing encrypted password so we can keep it when the field is left blank
  const [existing] = await db
    .select({ passEnc: emailSettings.smtpPassEncrypted })
    .from(emailSettings)
    .where(eq(emailSettings.id, 1))
    .limit(1);

  let newPassEncrypted: string | null = existing?.passEnc ?? null;

  if (data.smtpPass && data.smtpPass.trim().length > 0) {
    if (!isEncryptionReady()) {
      return NextResponse.json({
        error: 'Şifreleme anahtarı (EMAIL_ENCRYPTION_KEY) eksik. Parola kaydedilemez.',
      }, { status: 503 });
    }
    const enc = encrypt(data.smtpPass.trim());
    if (!enc) {
      return NextResponse.json({ error: 'Parola şifrelenemedi.' }, { status: 500 });
    }
    newPassEncrypted = enc;
  }

  const row = {
    id:                1 as const,
    enabled:           data.enabled,
    providerType:      data.providerType,
    smtpHost:          data.smtpHost          ?? null,
    smtpPort:          data.smtpPort          ?? 587,
    smtpSecure:        data.smtpSecure,
    smtpUser:          data.smtpUser          ?? null,
    smtpPassEncrypted: newPassEncrypted,
    fromName:          data.fromName          ?? null,
    fromEmail:         data.fromEmail         ?? null,
    replyToEmail:      data.replyToEmail      ?? null,
    adminNotifyEmails: data.adminNotifyEmails ?? null,
    updatedAt:         new Date(),
    updatedBy:         session.adminId,
  };

  await db
    .insert(emailSettings)
    .values(row)
    .onConflictDoUpdate({ target: emailSettings.id, set: row });

  // Audit log — no credentials
  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action:      'EMAIL_SETTINGS_UPDATED',
    entityType:  'EmailSettings',
    entityId:    '1',
    metadata:    {
      ip,
      enabled:         data.enabled,
      providerType:    data.providerType,
      passwordChanged: data.smtpPass ? true : false,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
