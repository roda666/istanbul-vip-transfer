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
import { getRequestPageSlug } from '@/lib/request-origin';
import { getTrustedClientIp } from '@/lib/request-client-ip';
import { verifyFormGuardToken } from '@/lib/form-guard';
import { recordBotProtectionBlock } from '@/lib/bot-protection-metrics';
import {
  persistReservationRecoveryFallback,
  resolveReservationRecoveryFallback,
} from '@/lib/reservation-recovery-storage';

export const dynamic = 'force-dynamic';

const MAX_RESERVATION_BODY_BYTES = 64 * 1024;
const RESERVATION_WRITE_ATTEMPTS = 3;
const RESERVATION_WRITE_RETRY_DELAYS_MS = [0, 150, 600] as const;

async function readBodyWithinLimit(req: NextRequest, maxBytes: number): Promise<string | null> {
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

  if (!req.body) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

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

class ReservationWriteAttemptsError extends Error {
  readonly originalError: unknown;
  readonly attempts: number;

  constructor(originalError: unknown, attempts: number) {
    super('Reservation write attempts exhausted');
    this.name = 'ReservationWriteAttemptsError';
    this.originalError = originalError;
    this.attempts = attempts;
  }
}

function safeDatabaseIdentifier(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,120}$/.test(value)) return null;
  return value;
}

function describeDatabaseFailure(error: unknown, stage: string): string {
  let candidate = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!candidate || typeof candidate !== 'object') break;
    const record = candidate as Record<string, unknown>;
    const code = safeDatabaseIdentifier(record.code);
    const constraint = safeDatabaseIdentifier(record.constraint);
    const table = safeDatabaseIdentifier(record.table);
    const column = safeDatabaseIdentifier(record.column);
    if (code || constraint || table || column) {
      return [
        'reservation_write_failed',
        `stage=${stage}`,
        `code=${code ?? 'unknown'}`,
        constraint ? `constraint=${constraint}` : null,
        table ? `table=${table}` : null,
        column ? `column=${column}` : null,
      ].filter(Boolean).join('; ');
    }
    candidate = record.cause;
  }
  return `reservation_write_failed; stage=${stage}; code=unknown`;
}

function sanitizeStructuredValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (typeof value === 'string') return sanitizeText(value).slice(0, 500);
  if (typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 20)
      .map((item) => sanitizeStructuredValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, 50)) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) continue;
      const nested = sanitizeStructuredValue(nestedValue, depth + 1);
      if (nested !== undefined) sanitized[key] = nested;
    }
    return sanitized;
  }
  return undefined;
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
  formGuardToken:    z.string().optional(),
  website:           z.string().optional(),
  company:           z.string().optional(),
  formData:          z.record(z.unknown()),
});

const DISCONTINUED_FORM_FIELDS = new Set([
  'cocukKoltugu',
  'aracTercihi',
  'ekNotlar',
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
  lastError: string;
  attempts: number;
}): Promise<{ persisted: boolean; created: boolean }> {
  try {
    const { db } = await import('@/db');
    const { reservationSubmissionFailures } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    const inserted = await db.insert(reservationSubmissionFailures).values({
      submissionId: input.submissionId,
      referenceNumber: input.referenceNumber,
      requestPayload: input.requestPayload,
      lastError: input.lastError,
      attempts: input.attempts,
    }).onConflictDoNothing({
      target: reservationSubmissionFailures.submissionId,
    }).returning({ id: reservationSubmissionFailures.id });

    if (inserted.length > 0) return { persisted: true, created: true };

    const updated = await db.update(reservationSubmissionFailures).set({
      requestPayload: input.requestPayload,
      lastError: input.lastError,
      attempts: sql`${reservationSubmissionFailures.attempts} + ${input.attempts}`,
      updatedAt: new Date(),
    }).where(eq(reservationSubmissionFailures.submissionId, input.submissionId))
      .returning({ id: reservationSubmissionFailures.id });
    return { persisted: updated.length > 0, created: false };
  } catch {
    console.error('[submit-request] failed to persist recovery record', {
      submissionId: input.submissionId,
      referenceNumber: input.referenceNumber,
    });
    return persistReservationRecoveryFallback(input);
  }
}

async function notifyAdminsOfReservationFailure(input: {
  referenceNumber: string;
  attempts: number;
  lastError: string;
}) {
  try {
    const recipients = await getAdminNotifyEmails();
    const results = await Promise.all(recipients.map((to) => sendEmailDetailed({
      to,
      subject: `ACİL: Rezervasyon yazılamadı — ${input.referenceNumber}`,
      text: [
        `Rezervasyon talebi ${input.attempts} veritabanı yazma denemesinden sonra kaydedilemedi.`,
        `Referans: ${input.referenceNumber}`,
        `Hata: ${input.lastError}`,
        'Kurtarma kaydı admin dashboardunda bekliyor.',
      ].join('\n'),
      html: [
        '<h2 style="color:#b91c1c">Rezervasyon yazma hatası</h2>',
        `<p><strong>Referans:</strong> ${escapeHtml(input.referenceNumber)}</p>`,
        `<p><strong>Deneme:</strong> ${input.attempts}</p>`,
        `<p><strong>Hata:</strong> ${escapeHtml(input.lastError)}</p>`,
        '<p>Kurtarma kaydı admin dashboardunda bekliyor.</p>',
      ].join(''),
      source: 'BOOKING_WRITE_FAILURE_ALERT',
      requestReference: input.referenceNumber,
    })));
    const failedCodes = [...new Set(results.filter((result) => !result.ok).map((result) => result.code))];
    if (failedCodes.length > 0) {
      console.error('[submit-request] reservation failure alert delivery failed', {
        referenceNumber: input.referenceNumber,
        failedCodes,
      });
    }
  } catch {
    console.error('[submit-request] failed to send reservation failure alert', {
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

  // Parse body
  let body: unknown;
  try {
    const rawBody = await readBodyWithinLimit(req, MAX_RESERVATION_BODY_BYTES);
    if (rawBody === null) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;
  // This key is created by the browser and reused by its retry loop. Legacy
  // callers without one still receive a server-generated UUID.
  const submissionId = data.submissionId ?? randomUUID();
  const referenceNumber = generateRefNumber();

  // A committed request must remain replayable even when the caller has since
  // exhausted its rate limit. This lookup returns no PII and does not mutate a
  // new-submission budget.
  if (data.submissionId) {
    try {
      const { db } = await import('@/db');
      const { reservationRequests, reservationSubmissionFailures } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [existingRequest] = await db
        .select({ referenceNumber: reservationRequests.referenceNumber })
        .from(reservationRequests)
        .where(eq(reservationRequests.submissionId, submissionId))
        .limit(1);
      if (existingRequest) {
        await db.update(reservationSubmissionFailures).set({
          resolvedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(reservationSubmissionFailures.submissionId, submissionId)).catch(() => {});
        await resolveReservationRecoveryFallback(submissionId);
        return NextResponse.json({
          referenceNumber: existingRequest.referenceNumber,
          requestSaved: true,
          replayed: true,
        });
      }
    } catch {
      // New submissions still pass through the persistent fail-closed limiter.
      // If the database is unavailable, the main write path records its
      // independently durable recovery fallback.
    }
  }

  // Rate limit only genuinely new submissions by IP.
  const ip = getTrustedClientIp(req);
  const rateLimitIdentity = ip ?? 'unknown';
  const maxAttempts = ip ? 10 : 100;
  try {
    const limit = await rateLimit(`reservation:${rateLimitIdentity}`, {
      maxAttempts,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      await recordBotProtectionBlock({ formType: 'RESERVATION', reason: 'RATE_LIMIT' });
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

  // A reservation can only claim a language that is actually public. This is
  // catalog-backed so a future language does not fail schema validation merely
  // because it was not part of the original static locale tuple.
  const { getPublicLangCodes } = await import('@/lib/i18n/active-locales');
  if (!(await getPublicLangCodes()).includes(data.locale)) {
    return NextResponse.json({ error: 'Unsupported or unpublished locale' }, { status: 422 });
  }

  // Honeypot check — return 200 to not reveal detection, but don't save
  if (data.website?.trim() || data.company?.trim()) {
    await recordBotProtectionBlock({ formType: 'RESERVATION', reason: 'HONEYPOT' });
    return NextResponse.json({ referenceNumber: generateRefNumber() });
  }

  const formGuardCheck = verifyFormGuardToken(data.formGuardToken, 'reservation');
  if (formGuardCheck !== 'valid') {
    await recordBotProtectionBlock({ formType: 'RESERVATION', reason: 'FORM_TIMING' });
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
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(k)) continue;
    const sanitizedValue = sanitizeStructuredValue(v);
    if (sanitizedValue !== undefined) safeFormData[k] = sanitizedValue;
  }
  const submittedCustomFields = getSubmittedCustomFields(data.formData.customFields);

  try {
    const { db } = await import('@/db');
    const {
      reservationRequests,
      reservationSubmissionFailures,
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
      await db.update(reservationSubmissionFailures).set({
        resolvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(reservationSubmissionFailures.submissionId, submissionId)).catch(() => {});
      await resolveReservationRecoveryFallback(submissionId);
      return NextResponse.json({
        referenceNumber: existingRequest.referenceNumber,
        requestSaved: true,
        replayed: true,
      });
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

    // Save reservation request. Browser navigation to WhatsApp can interrupt a
    // client-side retry, so the durability guarantee belongs on the server.
    let writeError: unknown = null;
    let writeAttempts = 0;
    for (let attempt = 1; attempt <= RESERVATION_WRITE_ATTEMPTS; attempt += 1) {
      writeAttempts = attempt;
      if (attempt > 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, RESERVATION_WRITE_RETRY_DELAYS_MS[attempt - 1]);
        });
      }
      try {
        const inserted = await db.insert(reservationRequests).values({
          referenceNumber,
          submissionId,
          intent:          data.intent,
          serviceType:     data.serviceType,
          name:            sanitizeText(data.adSoyad).slice(0, 120),
          phone:           sanitizeText(data.telefon).slice(0, 30),
          normalizedEmail,
          locale:          data.locale ?? 'tr',
          source:          `booking-form:${data.serviceType}`,
          pageSlug:        getRequestPageSlug(req, '/bilinmiyor'),
          requestData:     safeFormData,
          status:          'NEW',
        }).onConflictDoNothing({
          target: reservationRequests.submissionId,
        }).returning({ referenceNumber: reservationRequests.referenceNumber });

        // Two keepalive requests can overlap: both may pass the pre-insert
        // lookup before the first transaction commits. The unique submission
        // key is idempotency, not a write failure. Return the committed request
        // instead of creating a false recovery incident.
        if (inserted.length === 0) {
          const [concurrentRequest] = await db
            .select({ referenceNumber: reservationRequests.referenceNumber })
            .from(reservationRequests)
            .where(eq(reservationRequests.submissionId, submissionId))
            .limit(1);
          if (concurrentRequest) {
            await db.update(reservationSubmissionFailures).set({
              resolvedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(reservationSubmissionFailures.submissionId, submissionId)).catch(() => {});
            await resolveReservationRecoveryFallback(submissionId);
            return NextResponse.json({
              referenceNumber: concurrentRequest.referenceNumber,
              requestSaved: true,
              replayed: true,
            });
          }
          throw new Error('Idempotent reservation conflict could not be resolved');
        }
        writeError = null;
        break;
      } catch (error) {
        writeError = error;
      }
    }
    if (writeError) throw new ReservationWriteAttemptsError(writeError, writeAttempts);
    await resolveReservationRecoveryFallback(submissionId);

    const communications: Record<string, unknown> = {};
    // Explicit consent starts double opt-in only. A newsletter-side failure
    // cannot turn an already durable reservation into a write incident.
    if (normalizedEmail && data.newsletterConsent) {
      try {
        await startNewsletterOptIn({
          email: normalizedEmail, name: sanitizeText(data.adSoyad).slice(0, 120),
          language: data.locale, source: `booking-form:${data.serviceType}`, request: req,
        });
        communications.newsletterOptIn = { status: 'started' };
      } catch {
        communications.newsletterOptIn = { status: 'failed', code: 'NEWSLETTER_PROCESSING_FAILED' };
      }
    }
    // Booking is durable before mail is attempted. Store only sanitized,
    // non-PII delivery categories for the panel.
    try {
      const customer = normalizedEmail ? await sendEmailDetailed({
        to: normalizedEmail, subject: `Talebiniz alındı — ${referenceNumber}`,
        text: `Talebiniz alındı. Referans numaranız: ${referenceNumber}`,
        html: `<p>Talebiniz alındı.</p><p><strong>Referans numaranız:</strong> ${escapeHtml(referenceNumber)}</p>`,
        source: 'BOOKING_CUSTOMER_CONFIRMATION',
        requestReference: referenceNumber,
      }) : null;
      communications.customerConfirmation = customer
        ? deliverySummary(customer)
        : { status: 'not-requested', code: 'NO_VALID_EMAIL', acceptedCount: 0, rejectedCount: 0 };
      const admins = await getAdminNotifyEmails();
      const results = await Promise.all(admins.map((to) => sendEmailDetailed({
        to, subject: `Yeni transfer talebi — ${referenceNumber}`,
        text: `Referans: ${referenceNumber}\nAd Soyad: ${sanitizeText(data.adSoyad).slice(0, 120)}\nTelefon: ${sanitizeText(data.telefon).slice(0, 30)}\nE-posta: ${normalizedEmail ?? '—'}`,
        html: `<h2>Yeni Transfer Talebi</h2><p><strong>Referans:</strong> ${escapeHtml(referenceNumber)}</p><p><strong>Ad Soyad:</strong> ${escapeHtml(sanitizeText(data.adSoyad).slice(0, 120))}</p>`,
        source: 'BOOKING_ADMIN_NOTIFICATION',
        requestReference: referenceNumber,
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
    const adminNotification = communications.adminNotification as { status?: string } | undefined;
    return NextResponse.json({
      referenceNumber,
      requestSaved: true,
      emailNotification: { status: adminNotification?.status ?? 'failed' },
    }, { status: adminNotification?.status === 'sent' ? 201 : 202 });
  } catch (err) {
    const writeAttempts = err instanceof ReservationWriteAttemptsError ? err.attempts : 1;
    const originalError = err instanceof ReservationWriteAttemptsError ? err.originalError : err;
    const lastError = describeDatabaseFailure(
      originalError,
      err instanceof ReservationWriteAttemptsError ? 'reservation_insert' : 'reservation_flow',
    );
    const recovery = await recordSubmissionFailure({
      submissionId,
      referenceNumber,
      attempts: writeAttempts,
      lastError,
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
    if (recovery.created || !recovery.persisted) {
      await notifyAdminsOfReservationFailure({ referenceNumber, attempts: writeAttempts, lastError });
    }
    // Log error type only — never log personal data.
    console.error('[submit-request] DB error', { referenceNumber, lastError, recoveryPersisted: recovery.persisted });
    return NextResponse.json({ error: 'Database error', requestSaved: false, referenceNumber }, { status: 500 });
  }
}
