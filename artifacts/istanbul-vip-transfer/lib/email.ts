/**
 * Email utility for sending admin alert emails.
 *
 * Reads SMTP configuration from environment variables:
 *   SMTP_HOST   — e.g. smtp.gmail.com
 *   SMTP_PORT   — e.g. 587 (TLS) or 465 (SSL); defaults to 587
 *   SMTP_SECURE — "true" for SSL (port 465); defaults to false
 *   SMTP_USER   — SMTP authentication username
 *   SMTP_PASS   — SMTP authentication password
 *   SMTP_FROM   — Sender address, e.g. "VIP Transfer Admin <admin@example.com>"
 *
 * Returns `true` when the message is accepted by the SMTP server, `false` in
 * every other case (SMTP not configured, credentials invalid, network error,
 * missing ADMIN_EMAIL, etc.).  The caller must not advance cooldown state
 * unless `true` is returned — a `false` return means the admin was NOT notified.
 *
 * NOTE: nodemailer is dynamically imported inside sendEmail() so webpack does
 * not attempt to bundle it into the instrumentation/client-fallback bundle.
 */
import 'server-only';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends an email and returns `true` on confirmed transport delivery.
 * Returns `false` (never throws) when SMTP is not configured or delivery fails.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const from = process.env.SMTP_FROM
    ?? `VIP Transfer Admin <${process.env.SMTP_USER ?? 'admin@istanbulviptransfer.com'}>`;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;

  if (!host || !user) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER missing) — would have sent:',
      { to: opts.to, subject: opts.subject },
    );
    console.info('[email] Body (plain):', opts.text ?? '(no plain text)');
    return false; // not delivered — do NOT advance cooldown
  }

  try {
    // Dynamic import keeps nodemailer out of the webpack instrumentation bundle.
    const nodemailer = await import('nodemailer');

    const port   = parseInt(process.env.SMTP_PORT ?? '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: process.env.SMTP_PASS ?? '' },
    });

    const info = await transporter.sendMail({
      from,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
    });

    // Nodemailer resolves even when the SMTP server rejects recipients — check
    // the accepted/rejected arrays to confirm actual delivery.
    // accepted/rejected entries may be strings or Address objects.
    const addrStr = (a: string | { address?: string; name?: string }) =>
      typeof a === 'string' ? a : (a.address ?? '');

    const accepted = (info.accepted ?? []).map(addrStr);
    const rejected = (info.rejected ?? []).map(addrStr);

    const toAddr = opts.to.toLowerCase();
    const wasAccepted = accepted.some(
      (a) => a.toLowerCase() === toAddr || a.toLowerCase().includes(`<${toAddr}>`),
    );
    const wasRejected = rejected.some(
      (r) => r.toLowerCase() === toAddr || r.toLowerCase().includes(`<${toAddr}>`),
    );

    if (wasRejected || (!wasAccepted && rejected.length > 0)) {
      console.error('[email] Recipient rejected by SMTP server:', opts.to, '— rejected:', rejected);
      return false; // recipient not accepted — do NOT advance cooldown
    }

    if (!wasAccepted && accepted.length === 0 && rejected.length === 0) {
      // Some SMTP servers return empty arrays (local relay, stub transports).
      // Treat as success — the sendMail promise resolved without error.
      console.info('[email] Sent to', opts.to, '(SMTP returned no accepted/rejected lists) —', opts.subject);
      return true;
    }

    console.info('[email] Sent to', opts.to, '—', opts.subject);
    return true; // recipient confirmed in accepted list
  } catch (err) {
    console.error('[email] Failed to send email:', err);
    return false; // transport error — do NOT advance cooldown
  }
}
