import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { getTrustedClientIp } from '@/lib/request-client-ip';
import {
  encryptTurnstileSecret,
  ensureTurnstileSecretEncryption,
} from '@/lib/turnstile-settings-crypto';

const settingsSchema = z.object({
  contactEnabled: z.boolean(),
  reservationEnabled: z.boolean(),
  siteKey: z.string().trim().max(256).optional().nullable(),
  secretKey: z.string().trim().max(512).optional().nullable(),
});

async function requireSuperAdmin() {
  const session = await requireAdminSession();
  if (session.role !== 'SUPER_ADMIN') throw new Error('forbidden');
  return session;
}

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === 'forbidden' ? 'Yetersiz yetki.' : 'Oturum açmanız gerekiyor.' },
      { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 },
    );
  }

  const encryptionReady = await ensureTurnstileSecretEncryption();
  try {
    const { db } = await import('@/db');
    const { turnstileSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db.select().from(turnstileSettings)
      .where(eq(turnstileSettings.id, 1))
      .limit(1);
    const siteKey = row?.siteKey ?? null;
    const secretSet = Boolean(row?.secretKeyEncrypted);
    return NextResponse.json({
      encryptionReady,
      contactEnabled: row?.contactEnabled ?? true,
      reservationEnabled: row?.reservationEnabled ?? false,
      siteKey,
      secretSet,
      configured: Boolean(siteKey?.trim() && secretSet),
    });
  } catch {
    return NextResponse.json({ error: 'Turnstile ayarları yüklenemedi.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ip = getTrustedClientIp(request) ?? 'unknown';
  try {
    const limited = await rateLimit(`turnstile-settings:${ip}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.success) {
      return NextResponse.json({ error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Ayar koruması geçici olarak kullanılamıyor.' }, { status: 503 });
  }

  let session;
  try {
    session = await requireSuperAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === 'forbidden' ? 'Yetersiz yetki.' : 'Oturum açmanız gerekiyor.' },
      { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 },
    );
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { contactEnabled, reservationEnabled, siteKey, secretKey } = parsed.data;
  const normalizedSiteKey = siteKey?.trim() || null;
  try {
    const { db } = await import('@/db');
    const { turnstileSettings, auditLogs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [existing] = await db.select({ secret: turnstileSettings.secretKeyEncrypted })
      .from(turnstileSettings)
      .where(eq(turnstileSettings.id, 1))
      .limit(1);

    let secretKeyEncrypted = existing?.secret ?? null;
    if (secretKey?.trim()) {
      secretKeyEncrypted = await encryptTurnstileSecret(secretKey.trim());
      if (!secretKeyEncrypted) {
        return NextResponse.json({ error: 'Gizli anahtar güvenli olarak kaydedilemedi. Lütfen tekrar deneyin.' }, { status: 503 });
      }
    }

    const row = {
      id: 1 as const,
      contactEnabled,
      reservationEnabled,
      siteKey: normalizedSiteKey,
      secretKeyEncrypted,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    };
    await db.insert(turnstileSettings).values(row)
      .onConflictDoUpdate({ target: turnstileSettings.id, set: row });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'TURNSTILE_SETTINGS_UPDATED',
      entityType: 'TurnstileSettings',
      entityId: '1',
      metadata: {
        contactEnabled,
        reservationEnabled,
        siteKeySet: Boolean(normalizedSiteKey),
        secretChanged: Boolean(secretKey?.trim()),
      },
    }).catch(() => {});

    const secretSet = Boolean(secretKeyEncrypted);
    return NextResponse.json({
      success: true,
      encryptionReady: await ensureTurnstileSecretEncryption(),
      contactEnabled,
      reservationEnabled,
      siteKey: normalizedSiteKey,
      secretSet,
      configured: Boolean(normalizedSiteKey && secretSet),
    });
  } catch {
    return NextResponse.json({ error: 'Turnstile ayarları kaydedilemedi.' }, { status: 500 });
  }
}