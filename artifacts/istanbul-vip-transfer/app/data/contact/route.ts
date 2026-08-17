/**
 * POST /data/contact
 * Public endpoint — saves a general contact form inquiry to the admin panel.
 * Distinct from /data/submit-request (booking form); stored with source='contact-form'.
 *
 * Security:
 *  - JSON content-type enforced
 *  - Honeypot field (_hp must be empty)
 *  - In-memory rate limit: 5 per hour per IP
 *  - Inputs sanitized and length-capped
 *  - Personal data never written to application logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

// ── Rate limiter: 5 per hour per IP (more conservative than booking form) ────
const contactStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Periodic cleanup — removes expired entries so the Map doesn't grow
 * unboundedly on a long-running server. Runs every 30 minutes, same pattern
 * as lib/auth/rate-limit.ts. `.unref()` lets the process exit cleanly.
 */
const CONTACT_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
let contactCleanupHandle: ReturnType<typeof setInterval> | null = null;
function ensureContactCleanup() {
  if (contactCleanupHandle) return;
  contactCleanupHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of contactStore.entries()) {
      if (entry.resetAt < now) contactStore.delete(key);
    }
  }, CONTACT_CLEANUP_INTERVAL_MS);
  contactCleanupHandle.unref?.();
}

function checkRateLimit(ip: string): boolean {
  ensureContactCleanup();
  const now = Date.now();
  const entry = contactStore.get(ip);
  if (!entry || entry.resetAt < now) {
    contactStore.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

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
  _hp:     z.string().optional(),   // honeypot — must be empty
});

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

  const referenceNumber = generateRefNumber();

  try {
    const { db } = await import('@/db');
    const { reservationRequests } = await import('@/db/schema');

    await db.insert(reservationRequests).values({
      referenceNumber,
      intent:      'QUOTE',
      serviceType: 'CONTACT_INQUIRY',
      name:        sanitizeText(data.name).slice(0, 120),
      phone:       data.phone ? sanitizeText(data.phone).slice(0, 30) : '',
      normalizedEmail: data.email.trim().toLowerCase(),
      locale:      data.locale ?? 'tr',
      source:      'contact-form',
      requestData: {
        subject: sanitizeText(data.subject).slice(0, 200),
        message: sanitizeText(data.message).slice(0, 3000),
      },
      status: 'NEW',
    });

    return NextResponse.json({ referenceNumber });
  } catch (err) {
    console.error('[contact] DB error:', (err as Error)?.message ?? 'unknown');
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
