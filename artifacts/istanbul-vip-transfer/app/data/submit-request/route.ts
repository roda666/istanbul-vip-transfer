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
import { isFiveMinuteIncrement, isValidPassengerCount, meetsAllocationMinimum } from '@/lib/booking-rules';

export const dynamic = 'force-dynamic';

// ── Rate limiter: 10 per hour per IP ─────────────────────────────────────────
const submitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Periodic cleanup — removes expired entries so the Map doesn't grow
 * unboundedly on a long-running server. Runs every 30 minutes, same pattern
 * as lib/auth/rate-limit.ts. `.unref()` lets the process exit cleanly.
 */
const SUBMIT_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
let submitCleanupHandle: ReturnType<typeof setInterval> | null = null;
function ensureSubmitCleanup() {
  if (submitCleanupHandle) return;
  submitCleanupHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of submitStore.entries()) {
      if (entry.resetAt < now) submitStore.delete(key);
    }
  }, SUBMIT_CLEANUP_INTERVAL_MS);
  submitCleanupHandle.unref?.();
}

function checkRateLimit(ip: string): boolean {
  ensureSubmitCleanup();
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

// ── Zod input schema ──────────────────────────────────────────────────────────
const RequestSchema = z.object({
  intent:            z.enum(['QUOTE', 'RESERVATION']),
  serviceType:       z.enum(['AIRPORT_TRANSFER', 'INTERCITY', 'ALLOCATION', 'TOUR']),
  adSoyad:           z.string().min(2).max(120),
  telefon:           z.string().min(7).max(30),
  email:             z.string().max(254).nullable().optional(),
  newsletterConsent: z.boolean().optional().default(false),
  locale:            z.string().min(2).max(12).optional().default('tr'),
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

  const referenceNumber = generateRefNumber();

  try {
    const { db } = await import('@/db');
    const {
      reservationRequests,
      newsletterSubscribers,
      newsletterConsentEvents,
      customReservationFields,
      locations,
    } = await import('@/db/schema');
    const { eq, and, inArray, isNull } = await import('drizzle-orm');

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

    // A reservation is always retained, but marketing data is created only
    // after explicit opt-in. No PENDING subscriber is created for non-consent.
    if (normalizedEmail && data.newsletterConsent) {
      const existing = await db
        .select({ id: newsletterSubscribers.id, status: newsletterSubscribers.status })
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.normalizedEmail, normalizedEmail))
        .limit(1);

      let subscriberId: string;

      if (existing.length > 0) {
        subscriberId = existing[0].id;
        await db
          .update(newsletterSubscribers)
          .set({ status: 'ACTIVE', updatedAt: new Date() })
          .where(eq(newsletterSubscribers.normalizedEmail, normalizedEmail));
      } else {
        const [inserted] = await db.insert(newsletterSubscribers).values({
          normalizedEmail,
          name:              sanitizeText(data.adSoyad).slice(0, 120),
          preferredLanguage: data.locale ?? 'tr',
          status:            'ACTIVE',
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
