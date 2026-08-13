/**
 * Centralised email utility.
 *
 * Config priority (both checked on every call):
 *   1. email_settings DB row (if enabled = true and smtp_host/smtp_user present)
 *   2. Environment variable fallback (SMTP_HOST/USER/PASS/PORT/SECURE/FROM)
 *
 * The plaintext SMTP password is NEVER logged or exposed.
 * sendEmail() never throws — it returns false on any failure.
 *
 * Convenience exports:
 *   getAdminNotifyEmails() — DB adminNotifyEmails list or ADMIN_EMAIL env var
 */
import 'server-only';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
}

/**
 * Load the active SMTP configuration.
 * Tries the DB row first, then falls back to environment variables.
 * Returns null if no usable config is found.
 */
async function getSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  // 1. Try DB settings
  try {
    const { db }           = await import('@/db');
    const { emailSettings } = await import('@/db/schema');
    const rows = await db.select().from(emailSettings).limit(1);
    const row  = rows[0];

    if (row?.enabled && row.smtpHost && row.smtpUser) {
      let pass = '';
      if (row.smtpPassEncrypted) {
        const { decrypt } = await import('@/lib/email-crypto');
        pass = decrypt(row.smtpPassEncrypted) ?? '';
      }

      const port   = row.smtpPort ?? 587;
      const secure = row.smtpSecure === 'ssl';
      const from   = row.fromName && row.fromEmail
        ? `${row.fromName} <${row.fromEmail}>`
        : (row.fromEmail ?? row.smtpUser);

      return {
        host: row.smtpHost,
        port,
        secure,
        user: row.smtpUser,
        pass,
        from,
        replyTo: row.replyToEmail ?? undefined,
      };
    }
  } catch {
    // DB not available — fall through to env var fallback
  }

  // 2. Env var fallback
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  if (!host || !user) return null;

  return {
    host,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user,
    pass:   process.env.SMTP_PASS ?? '',
    from:   process.env.SMTP_FROM
              ?? `VIP Transfer Admin <${user}>`,
  };
}

/**
 * Returns the list of admin notification email addresses.
 * Prefers DB adminNotifyEmails; falls back to ADMIN_EMAIL env var.
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
  } catch { /* ignore */ }

  const envEmail = process.env.ADMIN_EMAIL;
  return envEmail ? [envEmail] : [];
}

/**
 * Sends an email via the resolved SMTP config.
 * Returns true only when the message is confirmed accepted by the server.
 * Returns false (never throws) in every other case.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const cfg = await getSmtpConfig();

  if (!cfg) {
    console.warn('[email] SMTP not configured — would have sent:', {
      to: opts.to, subject: opts.subject,
    });
    console.info('[email] Body (plain):', opts.text ?? '(no plain text)');
    return false;
  }

  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.secure,
      auth:   { user: cfg.user, pass: cfg.pass },
    });

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

    if (wasRejected || (!wasAccepted && rejected.length > 0)) {
      console.error('[email] Recipient rejected:', opts.to, '— rejected:', rejected);
      return false;
    }

    if (!wasAccepted && accepted.length === 0 && rejected.length === 0) {
      console.info('[email] Sent (no accepted/rejected arrays) —', opts.subject);
      return true;
    }

    console.info('[email] Sent to', opts.to, '—', opts.subject);
    return true;
  } catch {
    // Never log the error object — it may contain credentials in some transports
    console.error('[email] Transport error while sending to', opts.to);
    return false;
  }
}
