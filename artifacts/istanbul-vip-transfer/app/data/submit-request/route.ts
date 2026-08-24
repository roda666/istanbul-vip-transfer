/**
 * POST /data/submit-request
 * Public endpoint — saves a booking quote/reservation request and optionally
 * creates a newsletter subscriber record when explicit consent is given.
 *
 * Security:
 *  - JSON content-type enforced
 *  - Honeypot field (_hp must be empty)
 *  - Database-backed rate limit (10 submissions / hour / IP)
 *  - Input sanitized and length-capped before DB write
 *  - Personal data never written to application logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { isFiveMinuteIncrement, isValidPassengerCount, meetsAllocationMinimum } from '@/lib/booking-rules';
import { rateLimit } from '@/lib/auth/rate-limit';
import { getAdminNotifyEmails, sendEmailDetailed } from '@/lib/email';
import { startNewsletterOptIn } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

// ── Reference number generator ────────────────────────────────────────────────

/**
 * Returns the current calendar date in Europe/Istanbul as YYYYMMDD.
 * Uses sv-SE locale (native YYYY-MM-DD output) to avoid any UTC shift
 * that would occur if we relied on toISOString().slice(0,10).
 */
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

// ── Email normalizer ──────────────────────────────────────────────────────────
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function deliverySummary(result: Awaited<ReturnType<typeof sendEmailDetailed>>) {
  return { status: result.ok ? 'sent' : result.code === 'SMTP_NOT_CONFIGURED' ? 'not-configured' : 'failed', code: result.code, acceptedCount: result.acceptedCount, rejectedCount: result.rejectedCount };
}

// ── Zod input schema ──────────────────────────────────────────────────────────
const RequestSchema = z.object({
  intent:            z.enum(['QUOTE', 'RESERVATION']),
  serviceType:       z.enum(['AIRPORT_TRANSFER', 'INTERCITY', 'ALLOCATION', 'TOUR']),
  adSoyad:           z.string().min(2).max(120),
  telefon:           z.string().min(7).max(30),
  email:             z.string().max(254).nullable().optional(),
  newsletterConsent: z.boolean().optional().default(false),
  locale:            z.string().min(2).max(12).optional().default('tr'),
  submissionId:      z.string().uuid().optional(),
  _hp:               z.string().optional(),
  formData:          z.record(z.unknown()),
});

const DISCONTINUED_FORM_FIELDS = new Set([
  'bagajSayisi',
  'cocukKoltugu',
  'aracTercihi',
  'ekNotlar',
  'ucusNumarasi',
  'seyahatYonu',
]);

const LOCATION_FIELD_KEYS = [
  'alisLokasyonu',
  'varisLokasyonu',
  'kalkisIli',
  'varisIli',
] as const;

const LOCATION_FIELD_REQUIREMENTS: Record<typeof LOCATION_FIELD_KEYS[number], {
  scope: 'LOCAL' | 'INTERCITY';
  direction: 'pickup' | 'dropoff';
}> = {
  alisLokasyonu: { scope: 'LOCAL', direction: 'pickup' },
  varisLokasyonu: { scope: 'LOCAL', direction: 'dropoff' },
  kalkisIli: { scope: 'INTERCITY', direction: 'pickup' },
  varisIli: { scope: 'INTERCITY', direction: 'dropoff' },
};

function getFormString(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

type SubmittedCustomFieldValue = { id: number; value: boolean | string };

function getSubmittedCustomFields(value: unknown): SubmittedCustomFieldValue[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 20).flatMap((item): SubmittedCustomFieldValue[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = record.id;
    const rawValue = record.value;
    if (!Number.isInteger(id) || (id as number) < 1) return [];
    if (rawValue === true) return [{ id: id as number, value: true }];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return [{ id: id as number, value: sanitizeText(rawValue).slice(0, 500) }];
    }
    return [];
  });
}

/**
 * Keep API validation aligned with the public form. Client validation improves
 * feedback; these checks prevent direct POSTs from bypassing booking limits.
 */
function validateBookingConstraints(
  formData: Record<string, unknown>,
  serviceType: string,
): string | null {
  if (!isValidPassengerCount(getFormString(formData, 'yolcuSayisi'))) {
    return 'Passenger count must be between 1 and 45.';
  }

  const minute = getFormString(formData, 'saatDakika');
  if (!isFiveMinuteIncrement(minute)) {
    return 'Minutes must use five-minute increments.';
  }

  if (serviceType === 'ALLOCATION') {
    const unit = getFormString(formData, 'tahsisSuresiUnit') || 'SAAT';
    if (!meetsAllocationMinimum(getFormString(formData, 'tahsisSuresi'), unit)) {
      return 'Allocation duration must be at least 4 hours.';
    }
  }

  return null;
}

/**
 * Keep failed requests visible without ever writing their personal data to
 * application logs. A database outage can prevent this secondary write too;
 * in that exceptional case the submission ID remains in server logs for
 * incident correlation.
 */
async function recordSubmissionFailure(input: {
  submissionId: string;
  referenceNumber: string;
  requestPayload: Record<string, unknown>;
}) {
  try {
    const { db } = await import('@/db');
    const { reservationSubmissionFailures } = await import('@/db/schema');
    const { sql } = await import('drizzle-orm');

    await db.insert(reservationSubmissionFailures).values({
      submissionId: input.submissionId,
      referenceNumber: input.referenceNumber,
      requestPayload: input.requestPayload,
      lastError: 'reservation_write_failed',
    }).onConflictDoUpdate({
      target: reservationSubmissionFailures.submissionId,
      set: {
        requestPayload: input.requestPayload,
        lastError: 'reservation_write_failed',
        attempts: sql`${reservationSubmissionFailures.attempts} + 1`,
        updatedAt: new Date(),
      },
    });
  } catch {
    console.error('[submit-request] failed to persist recovery record', {
      submissionId: input.submissionId,
      referenceNumber: input.referenceNumber,
    });
  }
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
    const limit = await rateLimit(`reservation:${ip}`, {
      maxAttempts: 10,
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
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  // A reservation can only claim a language that is actually public. This is
  // catalog-backed so a future language does not fail schema validation merely
  // because it was not part of the original static locale tuple.
  const { getPublicLangCodes } = await import('@/lib/i18n/active-locales');
  if (!(await getPublicLangCodes()).includes(data.locale)) {
    return NextResponse.json({ error: 'Unsupported or unpublished locale' }, { status: 422 });
  }

  // Honeypot check — return 200 to not reveal detection, but don't save
  if (data._hp && data._hp.trim().length > 0) {
    return NextResponse.json({ referenceNumber: generateRefNumber() });
  }

  const normalizedEmail = normalizeEmail(data.email);
  if (normalizedEmail && !z.string().email().safeParse(normalizedEmail).success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 422 });
  }

  const constraintError = validateBookingConstraints(data.formData, data.serviceType);
  if (constraintError) {
    return NextResponse.json({ error: constraintError }, { status: 422 });
  }

  // Sanitize service-specific data — cap each text field, strip scripts, and
  // never retain fields that have been removed from the public form.
  const safeFormData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data.formData)) {
    if (DISCONTINUED_FORM_FIELDS.has(k)) continue;
    if (typeof v === 'string') {
      safeFormData[k] = sanitizeText(v).slice(0, 500);
    } else {
      safeFormData[k] = v;
    }
  }
  const submittedCustomFields = getSubmittedCustomFields(data.formData.customFields);

  // This key is created by the browser and reused by its retry loop. Legacy
  // callers without one still receive a server-generated UUID.
  const submissionId = data.submissionId ?? randomUUID();
  const referenceNumber = generateRefNumber();

  try {
    const { db } = await import('@/db');
    const {
      reservationRequests,
      customReservationFields,
      locations,
      vehicles,
    } = await import('@/db/schema');
    const { eq, and, inArray, isNull } = await import('drizzle-orm');

    // A response can be lost after the database commit. Return the original
    // reference for a retry instead of creating a second request.
    const [existingRequest] = await db
      .select({ referenceNumber: reservationRequests.referenceNumber })
      .from(reservationRequests)
      .where(eq(reservationRequests.submissionId, submissionId))
      .limit(1);
    if (existingRequest) {
      return NextResponse.json({ referenceNumber: existingRequest.referenceNumber, replayed: true });
    }

    // A browser may only submit values for existing active admin-defined
    // fields. Labels always come from the server record, never the request.
    if (submittedCustomFields.length > 0) {
      const ids = [...new Set(submittedCustomFields.map((field) => field.id))];
      const configured = await db
        .select({
          id: customReservationFields.id,
          label: customReservationFields.label,
        })
        .from(customReservationFields)
        .where(and(
          eq(customReservationFields.isActive, true),
          inArray(customReservationFields.id, ids),
        ));
      const labelsById = new Map(configured.map((field) => [field.id, field.label]));
      const savedCustomFields = submittedCustomFields.flatMap((field) => {
        const label = labelsById.get(field.id);
        return label ? [{ id: field.id, label, value: field.value }] : [];
      });
      if (savedCustomFields.length > 0) safeFormData.customFields = savedCustomFields;
      else delete safeFormData.customFields;
    } else {
      delete safeFormData.customFields;
    }

    // Resolve an optional vehicle choice from the published public catalog.
    // The browser provides only an ID; the saved label always comes from DB.
    const selectedVehicleId = getFormString(data.formData, 'vehiclePreference');
    if (selectedVehicleId) {
      const [selectedVehicle] = await db
        .select({ id: vehicles.id, name: vehicles.name })
        .from(vehicles)
        .where(and(
          eq(vehicles.id, selectedVehicleId),
          eq(vehicles.status, 'PUBLISHED'),
          eq(vehicles.isActive, true),
        ))
        .limit(1);
      if (!selectedVehicle) {
        return NextResponse.json({ error: 'Seçilen araç artık kullanılamıyor.' }, { status: 422 });
      }
      safeFormData.vehiclePreference = selectedVehicle.name;
      safeFormData.vehiclePreferenceId = selectedVehicle.id;
    } else {
      delete safeFormData.vehiclePreference;
    }

    // Location controls submit stable IDs. Resolve every selected ID on the
    // server, so a stale/disabled location cannot be persisted and human-facing
    // output never has to trust a client-provided label. The name fallback keeps
    // historic form posts readable during a rolling deployment.
    const submittedLocationValues = LOCATION_FIELD_KEYS.flatMap((field) => {
      const value = getFormString(data.formData, field);
      return value ? [{ field, value }] : [];
    });
    if (submittedLocationValues.length > 0) {
      const activeLocations = await db
        .select({
          id: locations.id,
          name: locations.name,
          city: locations.city,
          district: locations.district,
          type: locations.type,
          scope: locations.scope,
          pickupEnabled: locations.pickupEnabled,
          dropoffEnabled: locations.dropoffEnabled,
        })
        .from(locations)
        .where(and(eq(locations.isActive, true), isNull(locations.archivedAt)));
      const references: Record<string, { id: string; name: string; city: string; district: string | null; type: string }> = {};

      for (const submitted of submittedLocationValues) {
        const location = activeLocations.find((candidate) => (
          candidate.id === submitted.value || candidate.name === submitted.value
        ));
        const requirement = LOCATION_FIELD_REQUIREMENTS[submitted.field];
        const directionEnabled = requirement.direction === 'pickup'
          ? location?.pickupEnabled
          : location?.dropoffEnabled;
        const scopeAllowed = location?.scope === requirement.scope || location?.scope === 'BOTH';
        if (!location || !scopeAllowed || !directionEnabled) {
          return NextResponse.json({ error: 'Seçilen lokasyon artık kullanılamıyor.' }, { status: 422 });
        }
        references[submitted.field] = location;
        safeFormData[submitted.field] = location.city ? `${location.name} (${location.city})` : location.name;
        safeFormData[`${submitted.field}Id`] = location.id;
      }
      safeFormData.locationReferences = references;
    }

    // Save reservation request
    await db.insert(reservationRequests).values({
      referenceNumber,
      submissionId,
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

    // Explicit consent starts double opt-in only; no marketing is sent to a
    // PENDING address and an old opt-out is never reactivated automatically.
    if (normalizedEmail && data.newsletterConsent) {
      await startNewsletterOptIn({
        email: normalizedEmail, name: sanitizeText(data.adSoyad).slice(0, 120),
        language: data.locale, source: `booking-form:${data.serviceType}`, origin: req.nextUrl.origin,
      });
    }
    // Booking is durable before mail is attempted. Store only sanitized,
    // non-PII delivery categories for the panel.
    const communications: Record<string, unknown> = {};
    try {
      const customer = normalizedEmail ? await sendEmailDetailed({
        to: normalizedEmail, subject: `Talebiniz alındı — ${referenceNumber}`,
        text: `Talebiniz alındı. Referans numaranız: ${referenceNumber}`,
        html: `<p>Talebiniz alındı.</p><p><strong>Referans numaranız:</strong> ${escapeHtml(referenceNumber)}</p>`,
      }) : null;
      communications.customerConfirmation = customer
        ? deliverySummary(customer)
        : { status: 'not-requested', code: 'NO_VALID_EMAIL', acceptedCount: 0, rejectedCount: 0 };
      const admins = await getAdminNotifyEmails();
      const results = await Promise.all(admins.map((to) => sendEmailDetailed({
        to, subject: `Yeni transfer talebi — ${referenceNumber}`,
        text: `Referans: ${referenceNumber}\nAd Soyad: ${sanitizeText(data.adSoyad).slice(0, 120)}\nTelefon: ${sanitizeText(data.telefon).slice(0, 30)}\nE-posta: ${normalizedEmail ?? '—'}`,
        html: `<h2>Yeni Transfer Talebi</h2><p><strong>Referans:</strong> ${escapeHtml(referenceNumber)}</p><p><strong>Ad Soyad:</strong> ${escapeHtml(sanitizeText(data.adSoyad).slice(0, 120))}</p>`,
      })));
      communications.adminNotification = {
        status: admins.length === 0 ? 'not-configured' : results.every((r) => r.ok) ? 'sent' : results.some((r) => r.ok) ? 'partial' : 'failed',
        recipientCount: admins.length, acceptedCount: results.filter((r) => r.ok).length,
        failureCodes: [...new Set(results.filter((r) => !r.ok).map((r) => r.code))],
      };
    } catch {
      communications.adminNotification = { status: 'failed', recipientCount: 0, acceptedCount: 0, failureCodes: ['NOTIFICATION_PROCESSING_FAILED'] };
    }
    await db.update(reservationRequests).set({
      requestData: { ...safeFormData, communication: communications },
      updatedAt: new Date(),
    }).where(eq(reservationRequests.referenceNumber, referenceNumber)).catch(() => {});
    return NextResponse.json({ referenceNumber });
  } catch (err) {
    await recordSubmissionFailure({
      submissionId,
      referenceNumber,
      requestPayload: {
        intent: data.intent,
        serviceType: data.serviceType,
        locale: data.locale,
        name: sanitizeText(data.adSoyad).slice(0, 120),
        phone: sanitizeText(data.telefon).slice(0, 30),
        email: normalizedEmail,
        formData: safeFormData,
      },
    });
    // Log error type only — never log personal data.
    console.error('[submit-request] DB error:', (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
