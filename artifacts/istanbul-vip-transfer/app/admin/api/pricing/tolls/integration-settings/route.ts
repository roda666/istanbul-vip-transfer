import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { db } from '@/db';
import { auditLogs, tollInstitutionApiSettings } from '@/db/schema';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integration-secrets-crypto';
import { maskSecret } from '@/lib/integration-secrets';

export const dynamic = 'force-dynamic';

const CONFIRMATION = 'API AYARLARINI TEMİZLE';

const serviceUrl = z.string().trim().min(1).max(500).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Servis adresi kimlik bilgisi içermeyen geçerli bir HTTPS URL olmalıdır.');

const settingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  serviceUrl,
  /** Omitted means retain the existing encrypted code; it is never a plaintext response field. */
  apiCode: z.string().trim().min(1).max(4096).optional(),
});

async function superAdmin() {
  try {
    const session = await requireAdminSession();
    return session.role === 'SUPER_ADMIN' ? session : null;
  } catch {
    return null;
  }
}

async function limited(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return rateLimit(`${ip}:toll-institution-api-settings`, { maxAttempts: 30 });
}

/** GET /admin/api/pricing/tolls/integration-settings — safe institution API metadata only. */
export async function GET() {
  if (!await superAdmin()) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  try {
    const [stored] = await db.select().from(tollInstitutionApiSettings).where(
      // The table is a singleton; explicitly constrain the sentinel row.
      eq(tollInstitutionApiSettings.id, 1),
    ).limit(1);
    if (!stored) {
      return NextResponse.json({ settings: { organizationName: '', serviceUrl: '', apiCodeConfigured: false, maskedApiCode: null } });
    }
    const apiCode = await decryptIntegrationSecret(stored.apiCodeCiphertext);
    if (!apiCode) return NextResponse.json({ error: 'API ayarları güvenli olarak okunamadı.' }, { status: 503 });
    return NextResponse.json({
      settings: {
        organizationName: stored.organizationName,
        serviceUrl: stored.serviceUrl,
        apiCodeConfigured: true,
        maskedApiCode: maskSecret(apiCode),
      },
    });
  } catch {
    return NextResponse.json({ error: 'API ayarları yüklenemedi.' }, { status: 503 });
  }
}

/** PUT /admin/api/pricing/tolls/integration-settings — replace institution metadata and optionally its encrypted code. */
export async function PUT(request: NextRequest) {
  const limit = await limited(request);
  if (!limit.success) return NextResponse.json({ error: 'Çok fazla deneme. Lütfen bekleyin.' }, { status: 429 });
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz API ayarları.' }, { status: 422 });
  try {
    const [existing] = await db.select({ apiCodeCiphertext: tollInstitutionApiSettings.apiCodeCiphertext })
      .from(tollInstitutionApiSettings)
      .where(eq(tollInstitutionApiSettings.id, 1))
      .limit(1);
    let apiCodeCiphertext = existing?.apiCodeCiphertext;
    if (parsed.data.apiCode !== undefined) {
      const newApiCode = parsed.data.apiCode;
      const encrypted = await encryptIntegrationSecret(newApiCode);
      if (!encrypted || await decryptIntegrationSecret(encrypted) !== newApiCode) {
        return NextResponse.json({ error: 'API kodu güvenli olarak kaydedilemedi.' }, { status: 503 });
      }
      apiCodeCiphertext = encrypted;
    } else if (!existing?.apiCodeCiphertext || !await decryptIntegrationSecret(existing.apiCodeCiphertext)) {
      return NextResponse.json({ error: 'Mevcut API kodu güvenli olarak okunamadı; yeni bir API kodu girin.' }, { status: 422 });
    }
    if (!apiCodeCiphertext) {
      return NextResponse.json({ error: 'İlk kayıtta API kodu gereklidir.' }, { status: 422 });
    }
    await db.transaction(async (tx) => {
      await tx.insert(tollInstitutionApiSettings).values({
        id: 1,
        organizationName: parsed.data.organizationName,
        serviceUrl: parsed.data.serviceUrl,
        apiCodeCiphertext,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      }).onConflictDoUpdate({
        target: tollInstitutionApiSettings.id,
        set: {
          organizationName: parsed.data.organizationName,
          serviceUrl: parsed.data.serviceUrl,
          apiCodeCiphertext,
          updatedAt: new Date(),
          updatedBy: session.adminId,
        },
      });
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'TOLL_INSTITUTION_API_SETTINGS_UPDATED',
        entityType: 'TollInstitutionApiSettings',
        entityId: '1',
        metadata: { action: 'updated' },
      });
    });
    const apiCode = await decryptIntegrationSecret(apiCodeCiphertext);
    if (!apiCode) return NextResponse.json({ error: 'API ayarları güvenli olarak okunamadı.' }, { status: 503 });
    return NextResponse.json({
      success: true,
      settings: {
        organizationName: parsed.data.organizationName,
        serviceUrl: parsed.data.serviceUrl,
        apiCodeConfigured: true,
        maskedApiCode: maskSecret(apiCode),
      },
    });
  } catch {
    return NextResponse.json({ error: 'API ayarları güvenli olarak kaydedilemedi.' }, { status: 503 });
  }
}

/** DELETE /admin/api/pricing/tolls/integration-settings — clear only the institution API settings. */
export async function DELETE(request: NextRequest) {
  const limit = await limited(request);
  if (!limit.success) return NextResponse.json({ error: 'Çok fazla deneme. Lütfen bekleyin.' }, { status: 429 });
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Onay metni gereklidir.' }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if (!body || body.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Silmek için "${CONFIRMATION}" onayı gereklidir.` }, { status: 422 });
  }
  try {
    await db.transaction(async (tx) => {
      await tx.delete(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, 1));
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'TOLL_INSTITUTION_API_SETTINGS_CLEARED',
        entityType: 'TollInstitutionApiSettings',
        entityId: '1',
        metadata: { action: 'cleared' },
      });
    });
    return NextResponse.json({
      success: true,
      settings: { organizationName: '', serviceUrl: '', apiCodeConfigured: false, maskedApiCode: null },
    });
  } catch {
    return NextResponse.json({ error: 'API ayarları temizlenemedi.' }, { status: 503 });
  }
}