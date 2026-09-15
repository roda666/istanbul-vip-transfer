import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { db } from '@/db';
import { auditLogs, tollInstitutionApiSettings } from '@/db/schema';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integration-secrets-crypto';
import { maskSecret } from '@/lib/integration-secrets';

export const dynamic = 'force-dynamic';

const serviceUrl = z.string().trim().min(1).max(500).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}, 'Servis adresi kimlik bilgisi içermeyen geçerli bir HTTPS URL olmalıdır.');
const normalizeOrganizationName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

const integrationCreateSchema = z.object({
  organizationName: z.string().trim().min(2, 'Kurum adı zorunludur.').max(200),
  serviceUrl,
  apiCode: z.string().trim().min(1, 'API kodu/anahtarı zorunludur.').max(4096),
  active: z.boolean(),
});

async function sessionFor(mode: 'view' | 'manage') {
  try {
    const session = await requireAdminSession();
    if (mode === 'view' && session.capabilities.fleet_pricing.canView) return session;
    if (mode === 'manage' && session.role === 'SUPER_ADMIN' && session.capabilities.fleet_pricing.canManage) return session;
  } catch {}
  return null;
}

async function limited(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return rateLimit(`${ip}:toll-institution-api-integrations`, { maxAttempts: 30 });
}

async function safeRow(row: typeof tollInstitutionApiSettings.$inferSelect) {
  const secret = await decryptIntegrationSecret(row.apiCodeCiphertext);
  if (!secret) throw new Error('decrypt');
  return {
    id: row.id,
    organizationName: row.organizationName,
    serviceUrl: row.serviceUrl,
    active: row.active,
    apiCodeConfigured: true,
    maskedApiCode: maskSecret(secret),
    updatedAt: row.updatedAt,
  };
}

/** Safe masked list; never selects a plaintext value because none is stored. */
export async function GET() {
  const session = await sessionFor('view');
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  try {
    const rows = await db.select().from(tollInstitutionApiSettings)
      .orderBy(asc(tollInstitutionApiSettings.organizationName), asc(tollInstitutionApiSettings.id));
    return NextResponse.json({
      integrations: await Promise.all(rows.map(safeRow)),
      canManage: session.role === 'SUPER_ADMIN' && session.capabilities.fleet_pricing.canManage,
    });
  } catch {
    return NextResponse.json({ error: 'API entegrasyonları güvenli olarak yüklenemedi.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const limit = await limited(request);
  if (!limit.success) return NextResponse.json({ error: 'Çok fazla deneme. Lütfen bekleyin.' }, { status: 429 });
  const session = await sessionFor('manage');
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  const parsed = integrationCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz API entegrasyonu.' }, { status: 422 });
  try {
    const encrypted = await encryptIntegrationSecret(parsed.data.apiCode);
    if (!encrypted || await decryptIntegrationSecret(encrypted) !== parsed.data.apiCode) {
      return NextResponse.json({ error: 'API kodu güvenli olarak kaydedilemedi.' }, { status: 503 });
    }
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(tollInstitutionApiSettings).values({
        organizationName: parsed.data.organizationName,
        organizationNameNormalized: normalizeOrganizationName(parsed.data.organizationName),
        serviceUrl: parsed.data.serviceUrl,
        apiCodeCiphertext: encrypted,
        active: parsed.data.active,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      }).returning();
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'TOLL_INSTITUTION_API_CREATED',
        entityType: 'TollInstitutionApiSettings',
        entityId: String(row.id),
        metadata: { organizationName: row.organizationName },
      });
      return row;
    });
    return NextResponse.json({ integration: await safeRow(created) }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return NextResponse.json({ error: 'Aynı kurum adı ve servis linki zaten kayıtlı.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'API entegrasyonu güvenli olarak kaydedilemedi.' }, { status: 503 });
  }
}