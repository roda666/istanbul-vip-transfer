/**
 * Centralised email utility.
 *
 * Config priority (both checked on every call):
 *   1. email_settings DB row (if enabled = true and smtp_host/smtp_user present)
 *   2. Environment variable fallback (SMTP_HOST/USER/PASS/PORT/SECURE/FROM)
 *
 * The plaintext SMTP password is NEVER logged or exposed.
 * sendEmailDetailed() never throws — it returns a sanitized SMTP outcome.
 * sendEmail() remains as a boolean compatibility wrapper for existing callers.
 *
 * Convenience exports:
 *   getAdminNotifyEmails() — DB adminNotifyEmails list or the product default
 */
import 'server-only';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Default recipient for booking, contact, and system notifications. */
export const DEFAULT_ADMIN_NOTIFY_EMAIL = 'roda66@gmail.com';

export type EmailDeliveryCode =
  | 'SMTP_NOT_CONFIGURED'
  | 'SMTP_CONFIG_INCOMPLETE'
  | 'SMTP_PASSWORD_MISSING'
  | 'SMTP_PASSWORD_UNREADABLE'
  | 'SMTP_CONNECTION_FAILED'
  | 'SMTP_AUTH_FAILED'
  | 'SMTP_RECIPIENT_REJECTED'
  | 'SMTP_ACCEPTANCE_UNCONFIRMED'
  | 'SMTP_SEND_FAILED'
  | 'SMTP_ACCEPTED';

export interface EmailDeliveryResult {
  ok: boolean;
  code: EmailDeliveryCode;
  message: string;
  acceptedCount: number;
  rejectedCount: number;
  messageId?: string;
  smtpResponseCode?: number;
}

export interface SmtpConnectionResult {
  ok: boolean;
  code: Exclude<EmailDeliveryCode, 'SMTP_RECIPIENT_REJECTED' | 'SMTP_ACCEPTANCE_UNCONFIRMED' | 'SMTP_SEND_FAILED' | 'SMTP_ACCEPTED'> | 'SMTP_CONNECTED';
  message: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
}

type SmtpConfigResolution =
  | { config: ResolvedSmtpConfig }
  | {
      config: null;
      code: Extract<EmailDeliveryCode, 'SMTP_NOT_CONFIGURED' | 'SMTP_CONFIG_INCOMPLETE' | 'SMTP_PASSWORD_MISSING' | 'SMTP_PASSWORD_UNREADABLE'>;
      message: string;
    };

function configFailure(
  code: Extract<EmailDeliveryCode, 'SMTP_NOT_CONFIGURED' | 'SMTP_CONFIG_INCOMPLETE' | 'SMTP_PASSWORD_MISSING' | 'SMTP_PASSWORD_UNREADABLE'>,
  message: string,
): SmtpConfigResolution {
  return { config: null, code, message };
}

/**
 * Load the active SMTP configuration.
 * An enabled but incomplete DB configuration is an explicit error. It must not
 * silently fall back to environment values and make the admin test misleading.
 */
async function getSmtpConfig(): Promise<SmtpConfigResolution> {
  // 1. Try DB settings
  try {
    const { db }           = await import('@/db');
    const { emailSettings } = await import('@/db/schema');
    const rows = await db.select().from(emailSettings).limit(1);
    const row  = rows[0];

    if (row?.enabled) {
      if (!row.smtpHost || !row.smtpUser) {
        return configFailure('SMTP_CONFIG_INCOMPLETE', 'Etkin SMTP ayarlarında sunucu adresi veya kullanıcı adı eksik.');
      }
      if (!row.smtpPassEncrypted) {
        return configFailure('SMTP_PASSWORD_MISSING', 'Etkin SMTP ayarlarında parola kayıtlı değil.');
      }

      const { decryptSmtpPassword } = await import('@/lib/email-settings-crypto');
      const pass = await decryptSmtpPassword(row.smtpPassEncrypted);
      if (!pass) {
        return configFailure('SMTP_PASSWORD_UNREADABLE', 'Kayıtlı SMTP parolası okunamadı. Parolayı panelden yeniden kaydedin.');
      }

      const port   = row.smtpPort ?? 587;
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return configFailure('SMTP_CONFIG_INCOMPLETE', 'Etkin SMTP ayarlarındaki port geçerli değil.');
      }
      const secure = row.smtpSecure === 'ssl';
      const from   = row.fromName && row.fromEmail
        ? `${row.fromName} <${row.fromEmail}>`
        : (row.fromEmail ?? row.smtpUser);

      return {
        config: {
          host: row.smtpHost,
          port,
          secure,
          requireTLS: !secure,
          user: row.smtpUser,
          pass,
          from,
          replyTo: row.replyToEmail ?? undefined,
        },
      };
    }
  } catch {
    // DB not available — fall through to env var fallback
  }

  // 2. Env var fallback
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host && !user && !pass) {
    return configFailure('SMTP_NOT_CONFIGURED', 'SMTP yapılandırması bulunamadı.');
  }
  if (!host || !user) {
    return configFailure('SMTP_CONFIG_INCOMPLETE', 'SMTP ortam ayarlarında sunucu adresi veya kullanıcı adı eksik.');
  }
  if (!pass) {
    return configFailure('SMTP_PASSWORD_MISSING', 'SMTP ortam ayarlarında parola eksik.');
  }

  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return configFailure('SMTP_CONFIG_INCOMPLETE', 'SMTP ortam ayarlarındaki port geçerli değil.');
  }

  return {
    config: {
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_SECURE !== 'true',
      user,
      pass,
      from: process.env.SMTP_FROM ?? `VIP Transfer Admin <${user}>`,
    },
  };
}

function getSmtpResponseCode(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d{3})\b/);
  return match ? Number(match[1]) : undefined;
}

function classifyTransportFailure(error: unknown): {
  code: 'SMTP_CONNECTION_FAILED' | 'SMTP_AUTH_FAILED';
  message: string;
} {
  const code = (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
  ) ? error.code : '';
  const responseCode = (
    typeof error === 'object'
    && error !== null
    && 'responseCode' in error
    && typeof error.responseCode === 'number'
  ) ? error.responseCode : undefined;

  if (code === 'EAUTH' || responseCode === 530 || responseCode === 534 || responseCode === 535) {
    return {
      code: 'SMTP_AUTH_FAILED',
      message: 'SMTP kimlik doğrulaması başarısız oldu. Kullanıcı adı ve parolayı kontrol edin.',
    };
  }

  if (code === 'ENOTFOUND') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucu adresi bulunamadı. Sunucu adresini kontrol edin.',
    };
  }
  if (code === 'ECONNREFUSED') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucusu bağlantıyı reddetti. Sunucu adresi, port ve güvenlik tipini kontrol edin.',
    };
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucusuna zamanında bağlanılamadı. Port kapalı olabilir veya sunucu erişilemiyor olabilir.',
    };
  }
  if (code === 'ECONNRESET' || code === 'EPROTO' || code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP güvenli bağlantısı kurulamadı. SSL/STARTTLS seçimini ve portu kontrol edin.',
    };
  }

  // Raw transport details are deliberately never returned because they can
  // contain hostnames or provider-specific connection metadata.
  return {
    code: 'SMTP_CONNECTION_FAILED',
    message: 'SMTP sunucusuna bağlanılamadı. Sunucu adresi, port, güvenlik tipi ve ağ erişimini kontrol edin.',
  };
}

async function createSmtpTransport(cfg: ResolvedSmtpConfig) {
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
}

/**
 * Returns the list of admin notification email addresses.
 * Prefers the panel's DB value. An empty existing setting uses the product
 * default; ADMIN_EMAIL is only a fallback when the database is unavailable.
 */
export async function getAdminNotifyEmails(): Promise<string[]> {
  try {
    const { db }           = await import('@/db');
    const { emailSettings } = await import('@/db/schema');
    const rows = await db.select({ emails: emailSettings.adminNotifyEmails }).from(emailSettings).limit(1);
    const raw  = rows[0]?.emails;
    if (raw) {
      const list = raw.split(',').map(e => e.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
    return [DEFAULT_ADMIN_NOTIFY_EMAIL];
  } catch { /* ignore */ }

  const envEmail = process.env.ADMIN_EMAIL;
  return envEmail ? [envEmail] : [DEFAULT_ADMIN_NOTIFY_EMAIL];
}

/**
 * Verifies the resolved SMTP configuration without sending a message.
 */
export async function verifySmtpConnection(): Promise<SmtpConnectionResult> {
  const resolution = await getSmtpConfig();
  if (!resolution.config) {
    return {
      ok: false,
      code: resolution.code,
      message: resolution.message,
    };
  }

  try {
    const transporter = await createSmtpTransport(resolution.config);
    await transporter.verify();
    return {
      ok: true,
      code: 'SMTP_CONNECTED',
      message: 'SMTP bağlantısı ve kimlik doğrulaması başarılı. Bu test e-posta göndermez.',
    };
  } catch (error) {
    const failure = classifyTransportFailure(error);
    return { ok: false, ...failure };
  }
}

/**
 * Sends an email and returns an evidence-based result. `ok` is true only when
 * the SMTP server explicitly accepted at least one recipient and rejected none.
 */
export async function sendEmailDetailed(opts: SendEmailOptions): Promise<EmailDeliveryResult> {
  const resolution = await getSmtpConfig();
  if (!resolution.config) {
    return {
      ok: false,
      code: resolution.code,
      message: resolution.message,
      acceptedCount: 0,
      rejectedCount: 0,
    };
  }

  try {
    const cfg = resolution.config;
    const transporter = await createSmtpTransport(cfg);
    const mailOpts: Record<string, unknown> = {
      from:    cfg.from,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
    };
    if (cfg.replyTo) mailOpts.replyTo = cfg.replyTo;

    const info = await transporter.sendMail(mailOpts);

    const addrStr = (a: string | { address?: string; name?: string }) =>
      typeof a === 'string' ? a : (a.address ?? '');

    const accepted = (info.accepted ?? []).map(addrStr);
    const rejected = (info.rejected ?? []).map(addrStr);
    const toAddr   = opts.to.toLowerCase();

    const wasAccepted = accepted.some(
      a => a.toLowerCase() === toAddr || a.toLowerCase().includes(`<${toAddr}>`),
    );
    const wasRejected = rejected.some(
      r => r.toLowerCase() === toAddr || r.toLowerCase().includes(`<${toAddr}>`),
    );

    if (wasRejected || rejected.length > 0) {
      return {
        ok: false,
        code: 'SMTP_RECIPIENT_REJECTED',
        message: 'SMTP sunucusu alıcıyı kabul etmedi.',
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
        smtpResponseCode: getSmtpResponseCode(info.response),
      };
    }

    if (!wasAccepted || accepted.length === 0) {
      return {
        ok: false,
        code: 'SMTP_ACCEPTANCE_UNCONFIRMED',
        message: 'SMTP sunucusu alıcının kabul edildiğini doğrulamadı.',
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
        smtpResponseCode: getSmtpResponseCode(info.response),
      };
    }

    return {
      ok: true,
      code: 'SMTP_ACCEPTED',
      message: 'SMTP sunucusu mesajı alıcı için kabul etti.',
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
      smtpResponseCode: getSmtpResponseCode(info.response),
    };
  } catch (error) {
    const failure = classifyTransportFailure(error);
    return {
      ok: false,
      ...failure,
      acceptedCount: 0,
      rejectedCount: 0,
    };
  }
}

/** Compatibility wrapper for existing notification callers. */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  return (await sendEmailDetailed(opts)).ok;
}
