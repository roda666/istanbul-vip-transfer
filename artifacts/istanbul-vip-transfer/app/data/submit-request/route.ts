/**
 * POST /data/submit-request
 * Public endpoint — saves a booking quote/reservation request and optionally
 * creates a newsletter subscriber record when explicit consent is given.
 *
 * Security:
 *  - JSON content-type enforced
 *  - Honeypot field (_hp must be empty)
 *  - Simple in-memory rate limit (10 submissions / hour / IP)
 *  - Input sanitized and length-capped before DB write
 *  - Personal data never written to application logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

// ── Rate limiter: 10 per hour per IP ─────────────────────────────────────────
const submitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = submitStore.get(ip);
  if (!entry || entry.resetAt < now) {
    submitStore.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ── Reference number generator ────────────────────────────────────────────────
function generateRefNumber(): string {
  const d     = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand    = '';
  for (let i = 0; i < 5; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `IVT-${d}-${rand}`;
}

// ── Email normalizer ──────────────────────────────────────────────────────────
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}

// ── Zod input schema ──────────────────────────────────────────────────────────
const RequestSchema = z.object({
  intent:            z.enum(['QUOTE', 'RESERVATION']),
  serviceType:       z.enum(['AIRPORT_TRANSFER', 'INTERCITY', 'ALLOCATION', 'TOUR']),
  adSoyad:           z.string().min(2).max(120),
  telefon:           z.string().min(7).max(30),
  email:             z.string().max(254).nullable().optional(),
  newsletterConsent: z.boolean().optional().default(false),
  locale:            z.string().min(2).max(5).optional().default('tr'),
  _hp:               z.string().optional(),
  formData:          z.record(z.unknown()),
});

// ── Consent text version ──────────────────────────────────────────────────────
const CONSENT_VERSION = '2026-07-28-v1';

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Enforce JSON
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  // Honeypot check — return 200 to not reveal detection, but don't save
  if (data._hp && data._hp.trim().length > 0) {
    return NextResponse.json({ referenceNumber: generateRefNumber() });
  }

  const normalizedEmail = normalizeEmail(data.email);

  // Sanitize service-specific data — cap each text field, strip scripts
  const safeFormData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data.formData)) {
    if (typeof v === 'string') {
      safeFormData[k] = sanitizeText(v).slice(0, 500);
    } else {
      safeFormData[k] = v;
    }
  }

  const referenceNumber = generateRefNumber();

  try {
    const { db } = await import('@/db');
    const { reservationRequests, newsletterSubscribers, newsletterConsentEvents } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // Save reservation request
    await db.insert(reservationRequests).values({
      referenceNumber,
      intent:          data.intent,
      serviceType:     data.serviceType,
      name:            sanitizeText(data.adSoyad).slice(0, 120),
      phone:           sanitizeText(data.telefon).slice(0, 30),
      normalizedEmail,
      locale:          data.locale ?? 'tr',
      source:          'booking-form',
      requestData:     safeFormData,
      status:          'NEW',
    });

    // Newsletter consent — only when explicitly checked and email is present
    if (data.newsletterConsent && normalizedEmail) {
      // Upsert subscriber (ignore duplicate on email)
      const existing = await db
        .select({ id: newsletterSubscribers.id })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.normalizedEmail, normalizedEmail))
        .limit(1);

      let subscriberId: string;

      if (existing.length > 0) {
        subscriberId = existing[0].id;
        // Re-activate if previously unsubscribed
        await db
          .update(newsletterSubscribers)
          .set({ status: 'PENDING', updatedAt: new Date() })
          .where(eq(newsletterSubscribers.normalizedEmail, normalizedEmail));
      } else {
        const [inserted] = await db.insert(newsletterSubscribers).values({
          normalizedEmail,
          name:              sanitizeText(data.adSoyad).slice(0, 120),
          preferredLanguage: data.locale ?? 'tr',
          status:            'PENDING',
          source:            `booking-form:${data.serviceType}`,
        }).returning({ id: newsletterSubscribers.id });
        subscriberId = inserted.id;
      }

      // Record consent event — use the visitor's actual locale, not a hardcoded 'tr'
      await db.insert(newsletterConsentEvents).values({
        subscriberId,
        normalizedEmail,
        action:             'GRANTED',
        consentTextVersion: CONSENT_VERSION,
        language:           data.locale ?? 'tr',
        source:             `booking-form:${data.serviceType}`,
      });
    }

    return NextResponse.json({ referenceNumber });
  } catch (err) {
    // Log error type only — never log personal data
    console.error('[submit-request] DB error:', (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
