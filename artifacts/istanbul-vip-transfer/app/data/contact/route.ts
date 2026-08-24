/**
 * POST /data/contact
 * Public endpoint — saves a general contact form inquiry to the admin panel.
 * Distinct from /data/submit-request (booking form); stored with source='contact-form'.
 *
 * Security:
 *  - JSON content-type enforced
 *  - Honeypot field (_hp must be empty)
 *  - Database-backed rate limit: 5 per hour per IP
 *  - Inputs sanitized and length-capped
 *  - Personal data never written to application logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { getAdminNotifyEmails, sendEmailDetailed } from '@/lib/email';
import { rateLimit } from '@/lib/auth/rate-limit';
import { startNewsletterOptIn } from '@/lib/newsletter';
import { getRequestPageSlug } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

// ── Reference number generator ────────────────────────────────────────────────
function getIstanbulDateStamp(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' })
    .format(new Date())
    .replace(/-/g, '');
}

function generateRefNumber(): string {
  const d     = getIstanbulDateStamp();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand    = '';
  for (let i = 0; i < 5; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `IVT-${d}-${rand}`;
}

// ── Zod input schema ──────────────────────────────────────────────────────────
const ContactSchema = z.object({
  name:    z.string().min(2).max(120),
  email:   z.string().email().max(254),
  phone:   z.string().max(30).optional().default(''),
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(3000),
  locale:  z.string().min(2).max(5).optional().default('tr'),
  newsletterConsent: z.boolean().optional().default(false),
  _hp:     z.string().optional(),   // honeypot — must be empty
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Enforce JSON
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  try {
    const limit = await rateLimit(`contact:${ip}`, {
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }
  } catch {
    // Fail closed when the persistent guard is unavailable rather than making
    // the public form an unbounded abuse path.
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;

  // Honeypot — silently succeed without saving
  if (data._hp && data._hp.trim().length > 0) {
    return NextResponse.json({ referenceNumber: generateRefNumber() });
  }

  // Consent evidence must reflect a real public locale, never an arbitrary
  // locale value supplied by a direct request.
  const { getPublicLangCodes } = await import('@/lib/i18n/active-locales');
  if (!(await getPublicLangCodes()).includes(data.locale)) {
    return NextResponse.json({ error: 'Unsupported or unpublished locale' }, { status: 422 });
  }

  const referenceNumber = generateRefNumber();
  const contact = {
    name:    sanitizeText(data.name).slice(0, 120),
    phone:   data.phone ? sanitizeText(data.phone).slice(0, 30) : '',
    email:   data.email.trim().toLowerCase(),
    subject: sanitizeText(data.subject).slice(0, 200),
    message: sanitizeText(data.message).slice(0, 3000),
    locale:  data.locale ?? 'tr',
  };
  const requestData = {
    subject: contact.subject,
    message: contact.message,
    emailNotification: {
      status: 'pending',
      attemptedAt: null,
      recipientCount: 0,
      acceptedCount: 0,
      failureCodes: [],
    },
  };

  try {
    const { db } = await import('@/db');
    const {
      reservationRequests,
      auditLogs,
    } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.insert(reservationRequests).values({
      referenceNumber,
      intent:      'QUOTE',
      serviceType: 'CONTACT_INQUIRY',
      name:        contact.name,
      phone:       contact.phone,
      normalizedEmail: contact.email,
      locale:      contact.locale,
      source:      'contact-form',
      pageSlug:    getRequestPageSlug(req, '/iletisim'),
      requestData,
      status: 'NEW',
    });

    // Explicit consent initiates double opt-in. It never activates an address
    // until the recipient uses the single-use confirmation link.
    if (data.newsletterConsent) {
      await startNewsletterOptIn({
        email: contact.email, name: contact.name, language: contact.locale,
        source: 'contact-form', origin: req.nextUrl.origin,
      });
    }

    // A saved request is never discarded because mail delivery is unavailable.
    // The notification outcome is persisted for admins without exposing it to
    // public callers or writing form content to server logs.
    try {
      const recipients = await getAdminNotifyEmails();
      const deliveries = await Promise.all(
        recipients.map(to => sendEmailDetailed({
          to,
          subject: `Yeni iletişim talebi — ${referenceNumber}`,
          text: [
            `Referans: ${referenceNumber}`,
            `Ad Soyad: ${contact.name}`,
            `E-posta: ${contact.email}`,
            contact.phone ? `Telefon: ${contact.phone}` : null,
            `Konu: ${contact.subject}`,
            '',
            contact.message,
          ].filter(Boolean).join('\n'),
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#172B3A;">
              <h2 style="color:#C99A32;margin:0 0 16px;">Yeni İletişim Talebi</h2>
              <p style="margin:0 0 16px;"><strong>Referans:</strong> ${escapeHtml(referenceNumber)}</p>
              <table style="border-collapse:collapse;width:100%;font-size:14px;">
                <tr><td style="padding:8px 0;color:#52697A;width:120px;">Ad Soyad</td><td style="padding:8px 0;">${escapeHtml(contact.name)}</td></tr>
                <tr><td style="padding:8px 0;color:#52697A;">E-posta</td><td style="padding:8px 0;">${escapeHtml(contact.email)}</td></tr>
                ${contact.phone ? `<tr><td style="padding:8px 0;color:#52697A;">Telefon</td><td style="padding:8px 0;">${escapeHtml(contact.phone)}</td></tr>` : ''}
                <tr><td style="padding:8px 0;color:#52697A;">Konu</td><td style="padding:8px 0;">${escapeHtml(contact.subject)}</td></tr>
              </table>
              <div style="margin-top:16px;padding:14px;background:#F3F6FA;border-radius:8px;white-space:pre-wrap;">${escapeHtml(contact.message)}</div>
            </div>`,
        })),
      );
      const acceptedCount = deliveries.filter(result => result.ok).length;
      const failedCodes = [...new Set(deliveries.filter(result => !result.ok).map(result => result.code))];
      const notification = {
        status: recipients.length === 0
          ? 'not-configured'
          : acceptedCount === recipients.length
            ? 'sent'
            : acceptedCount > 0
              ? 'partial'
              : 'failed',
        attemptedAt: new Date().toISOString(),
        recipientCount: recipients.length,
        acceptedCount,
        failureCodes: failedCodes,
      };

      await db.update(reservationRequests)
        .set({ requestData: { ...requestData, emailNotification: notification } })
        .where(eq(reservationRequests.referenceNumber, referenceNumber));

      await db.insert(auditLogs).values({
        action: 'CONTACT_EMAIL_NOTIFICATION',
        entityType: 'ReservationRequest',
        entityId: referenceNumber,
        metadata: notification,
      }).catch(() => {});
    } catch {
      const notification = {
        status: 'failed',
        attemptedAt: new Date().toISOString(),
        recipientCount: 0,
        acceptedCount: 0,
        failureCodes: ['NOTIFICATION_PROCESSING_FAILED'],
      };
      await db.update(reservationRequests)
        .set({ requestData: { ...requestData, emailNotification: notification } })
        .where(eq(reservationRequests.referenceNumber, referenceNumber))
        .catch(() => {});
      await db.insert(auditLogs).values({
        action: 'CONTACT_EMAIL_NOTIFICATION',
        entityType: 'ReservationRequest',
        entityId: referenceNumber,
        metadata: notification,
      }).catch(() => {});
      // The incoming request remains saved. No personal form details are logged.
      console.error('[contact] Admin email notification processing failed.');
    }

    return NextResponse.json({ referenceNumber });
  } catch (err) {
    console.error('[contact] DB error:', (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
