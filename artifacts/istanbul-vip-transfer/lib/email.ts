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
  /** Shown in the admin delivery history; never includes message content. */
  source?: string;
  /** Optional public request reference, not a personal-data payload. */
  requestReference?: string;
  /** Present only for an authenticated admin-triggered send. */
  adminUserId?: string;
  /** 'setting' | 'proxy-fallback' | 'unavailable' — set when this email embeds a link built from resolveEmailLinkOrigin(). */
  linkOriginMode?: string;
  /** True when the embedded link used a Replit preview domain (.replit.dev / .repl.co) instead of a real production domain. */
  previewDomainUsed?: boolean;
}

/** Default recipient for booking, contact, and system notifications. */
export const DEFAULT_ADMIN_NOTIFY_EMAIL = 'roda66@gmail.com';

export type EmailDeliveryCode =
  | 'SMTP_NOT_CONFIGURED'
  | 'SMTP_CONFIG_INCOMPLETE'
  | 'SMTP_PASSWORD_MISSING'
  | 'SMTP_PASSWORD_UNREADABLE'
  | 'SMTP_SENDER_DOMAIN_MISMATCH'
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
  /** Provider response, scrubbed of credentials and capped before persistence. */
  serverResponse: string;
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
  fromEmail: string;
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

export type SenderDomainCompatibility = {
  ok: boolean;
  message?: string;
  expectedDomain?: string;
};

function domainFromEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  if (!email) return null;
  const match = email.match(/^[^@\s]+@([^@\s]+)$/);
  return match?.[1] ?? null;
}

function expectedDomainFromHost(host: string | null | undefined): string | null {
  const parts = host?.trim().toLowerCase().split('.').filter(Boolean) ?? [];
  if (parts.length < 2 || parts.some((part) => !/^[a-z0-9-]+$/i.test(part))) return null;
  while (parts.length > 2 && ['smtp', 'mail', 'outbound', 'secure', 'relay'].includes(parts[0])) {
    parts.shift();
  }
  return parts.join('.');
}

/**
 * A sender must belong to the authenticated SMTP account's domain whenever it
 * can be determined. This prevents a personal Gmail address being presented as
 * the sender through an unrelated mail host.
 */
export function validateSenderDomainCompatibility(input: {
  smtpHost?: string | null;
  smtpUser?: string | null;
  fromEmail?: string | null;
}): SenderDomainCompatibility {
  const senderDomain = domainFromEmail(input.fromEmail);
  if (!senderDomain) return { ok: true };

  const expectedDomain = domainFromEmail(input.smtpUser) ?? expectedDomainFromHost(input.smtpHost);
  if (!expectedDomain) {
    return {
      ok: false,
      message: 'Gönderen adresinin alan adı doğrulanamadı. SMTP kullanıcı adını tam e-posta adresi olarak girin.',
    };
  }

  if (senderDomain === expectedDomain || senderDomain.endsWith(`.${expectedDomain}`)) {
    return { ok: true, expectedDomain };
  }
  return {
    ok: false,
    expectedDomain,
    message: 'Gönderen adresi SMTP sunucunuzun yetkili olduğu alan adıyla uyuşmuyor; postalar teslim edilmeyebilir.',
  };
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
          fromEmail: row.fromEmail ?? row.smtpUser,
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
      fromEmail: (() => {
        const configured = process.env.SMTP_FROM;
        const match = configured?.match(/<([^>]+)>/);
        return match?.[1] ?? configured ?? user;
      })(),
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
  smtpResponseCode?: number;
  serverResponse: string;
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
  const rawResponse = (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof error.response === 'string'
  ) ? error.response : '';
  const serverResponse = rawResponse.trim().replace(/\s+/g, ' ').slice(0, 1000)
    || 'SMTP sunucusundan ayrıntılı yanıt alınamadı.';

  if (code === 'EAUTH' || responseCode === 530 || responseCode === 534 || responseCode === 535) {
    return {
      code: 'SMTP_AUTH_FAILED',
      message: 'SMTP kimlik doğrulaması başarısız oldu. Kullanıcı adı ve parolayı kontrol edin.',
      smtpResponseCode: responseCode,
      serverResponse,
    };
  }

  if (code === 'ENOTFOUND') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucu adresi bulunamadı. Sunucu adresini kontrol edin.',
      smtpResponseCode: responseCode,
      serverResponse,
    };
  }
  if (code === 'ECONNREFUSED') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucusu bağlantıyı reddetti. Sunucu adresi, port ve güvenlik tipini kontrol edin.',
      smtpResponseCode: responseCode,
      serverResponse,
    };
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP sunucusuna zamanında bağlanılamadı. Port kapalı olabilir veya sunucu erişilemiyor olabilir.',
      smtpResponseCode: responseCode,
      serverResponse,
    };
  }
  if (code === 'ECONNRESET' || code === 'EPROTO' || code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'SMTP güvenli bağlantısı kurulamadı. SSL/STARTTLS seçimini ve portu kontrol edin.',
      smtpResponseCode: responseCode,
      serverResponse,
    };
  }

  // Raw transport details are deliberately never returned because they can
  // contain hostnames or provider-specific connection metadata.
  return {
    code: 'SMTP_CONNECTION_FAILED',
    message: 'SMTP sunucusuna bağlanılamadı. Sunucu adresi, port, güvenlik tipi ve ağ erişimini kontrol edin.',
    smtpResponseCode: responseCode,
    serverResponse,
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
 * the SMTP server explicitly accepted the intended recipient and rejected none.
 */
export async function sendEmailDetailed(opts: SendEmailOptions): Promise<EmailDeliveryResult> {
  const finish = async (result: EmailDeliveryResult): Promise<EmailDeliveryResult> => {
    const { persistEmailDeliveryAttempt } = await import('@/lib/email-delivery-log');
    await persistEmailDeliveryAttempt({
      recipient: opts.to,
      source: opts.source,
      requestReference: opts.requestReference,
      adminUserId: opts.adminUserId,
      resultCode: result.code,
      accepted: result.ok,
      acceptedCount: result.acceptedCount,
      rejectedCount: result.rejectedCount,
      smtpResponseCode: result.smtpResponseCode,
      serverResponse: result.serverResponse,
      messageId: result.messageId,
      linkOriginMode: opts.linkOriginMode,
      previewDomainUsed: opts.previewDomainUsed,
    });
    return result;
  };

  const resolution = await getSmtpConfig();
  if (!resolution.config) {
    return finish({
      ok: false,
      code: resolution.code,
      message: resolution.message,
      acceptedCount: 0,
      rejectedCount: 0,
      serverResponse: 'SMTP sunucusuna bağlantı kurulmadı; yerel yapılandırma tamamlanmadı.',
    });
  }

  try {
    const cfg = resolution.config;
    const senderCompatibility = validateSenderDomainCompatibility({
      smtpHost: cfg.host,
      smtpUser: cfg.user,
      fromEmail: cfg.fromEmail,
    });
    if (!senderCompatibility.ok) {
      return finish({
        ok: false,
        code: 'SMTP_SENDER_DOMAIN_MISMATCH',
        message: senderCompatibility.message ?? 'Gönderen adresi SMTP alan adıyla uyuşmuyor.',
        acceptedCount: 0,
        rejectedCount: 0,
        serverResponse: 'SMTP gönderimi başlatılmadı: gönderen alan adı uyumsuz.',
      });
    }
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
      return finish({
        ok: false,
        code: 'SMTP_RECIPIENT_REJECTED',
        message: 'SMTP sunucusu alıcıyı kabul etmedi.',
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
        smtpResponseCode: getSmtpResponseCode(info.response),
        serverResponse: typeof info.response === 'string' ? info.response.trim().replace(/\s+/g, ' ').slice(0, 1000) : 'SMTP sunucusu alıcıyı kabul etmedi.',
      });
    }

    if (!wasAccepted || accepted.length === 0) {
      return finish({
        ok: false,
        code: 'SMTP_ACCEPTANCE_UNCONFIRMED',
        message: 'SMTP sunucusu alıcının kabul edildiğini doğrulamadı.',
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
        smtpResponseCode: getSmtpResponseCode(info.response),
        serverResponse: typeof info.response === 'string' ? info.response.trim().replace(/\s+/g, ' ').slice(0, 1000) : 'SMTP sunucusu alıcı kabulünü doğrulamadı.',
      });
    }

    return finish({
      ok: true,
      code: 'SMTP_ACCEPTED',
      message: 'SMTP sunucusu mesajı alıcı için kabul etti.',
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
      smtpResponseCode: getSmtpResponseCode(info.response),
      serverResponse: typeof info.response === 'string' ? info.response.trim().replace(/\s+/g, ' ').slice(0, 1000) : 'SMTP sunucusu mesajı kabul etti.',
    });
  } catch (error) {
    const failure = classifyTransportFailure(error);
    return finish({
      ok: false,
      ...failure,
      acceptedCount: 0,
      rejectedCount: 0,
    });
  }
}

/** Compatibility wrapper for existing notification callers. */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  return (await sendEmailDetailed(opts)).ok;
}
