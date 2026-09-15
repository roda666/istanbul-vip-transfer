import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollInstitutionApiSettings } from '@/db/schema';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integration-secrets-crypto';
import { maskSecret } from '@/lib/integration-secrets';

const updateSchema = z.object({
  organizationName: z.string().trim().min(2, 'Kurum adı zorunludur.').max(200),
  serviceUrl: z.string().trim().max(500).refine((value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
    catch { return false; }
  }, 'Servis adresi kimlik bilgisi içermeyen geçerli bir HTTPS URL olmalıdır.'),
  apiCode: z.string().trim().min(1).max(4096).optional(),
  active: z.boolean(),
});
const normalizeOrganizationName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

async function superAdmin() {
  try {
    const session = await requireAdminSession();
    return session.role === 'SUPER_ADMIN' && session.capabilities.fleet_pricing.canManage ? session : null;
  } catch { return null; }
}

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function responseRow(row: typeof tollInstitutionApiSettings.$inferSelect) {
  const secret = await decryptIntegrationSecret(row.apiCodeCiphertext);
  if (!secret) throw new Error('decrypt');
  return { id: row.id, organizationName: row.organizationName, serviceUrl: row.serviceUrl, active: row.active, apiCodeConfigured: true, maskedApiCode: maskSecret(secret), updatedAt: row.updatedAt };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Geçersiz kayıt.' }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz API entegrasyonu.' }, { status: 422 });
  try {
    const [existing] = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'API entegrasyonu bulunamadı.' }, { status: 404 });
    let ciphertext = existing.apiCodeCiphertext;
    if (parsed.data.apiCode !== undefined) {
      const encrypted = await encryptIntegrationSecret(parsed.data.apiCode);
      if (!encrypted || await decryptIntegrationSecret(encrypted) !== parsed.data.apiCode) return NextResponse.json({ error: 'API kodu güvenli olarak kaydedilemedi.' }, { status: 503 });
      ciphertext = encrypted;
    } else if (!await decryptIntegrationSecret(ciphertext)) {
      return NextResponse.json({ error: 'Mevcut API kodu güvenli olarak okunamadı; yeni bir API kodu girin.' }, { status: 422 });
    }
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(tollInstitutionApiSettings).set({
        organizationName: parsed.data.organizationName,
        organizationNameNormalized: normalizeOrganizationName(parsed.data.organizationName),
        serviceUrl: parsed.data.serviceUrl,
        active: parsed.data.active,
        apiCodeCiphertext: ciphertext,
        updatedAt: new Date(),
        updatedBy: session.adminId,
      }).where(eq(tollInstitutionApiSettings.id, id)).returning();
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: existing.active !== parsed.data.active
          ? (parsed.data.active ? 'TOLL_INSTITUTION_API_ACTIVATED' : 'TOLL_INSTITUTION_API_DEACTIVATED')
          : 'TOLL_INSTITUTION_API_UPDATED',
        entityType: 'TollInstitutionApiSettings',
        entityId: String(id),
        metadata: { organizationName: row.organizationName },
      });
      return row;
    });
    return NextResponse.json({ integration: await responseRow(updated) });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'Aynı kurum adı ve servis linki zaten kayıtlı.' }, { status: 409 });
    return NextResponse.json({ error: 'API entegrasyonu güvenli olarak güncellenemedi.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  const id = parseId((await params).id);
  const body = await request.json().catch(() => null);
  if (!id || typeof body?.organizationName !== 'string') return NextResponse.json({ error: 'Kurum adıyla silme onayı gereklidir.' }, { status: 422 });
  try {
    const [existing] = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'API entegrasyonu bulunamadı.' }, { status: 404 });
    if (body.organizationName !== existing.organizationName) return NextResponse.json({ error: 'Kurum adıyla silme onayı eşleşmedi.' }, { status: 422 });
    await db.transaction(async (tx) => {
      await tx.delete(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, id));
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'TOLL_INSTITUTION_API_DELETED',
        entityType: 'TollInstitutionApiSettings',
        entityId: String(id),
        metadata: { organizationName: existing.organizationName },
      });
    });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'API entegrasyonu silinemedi.' }, { status: 503 });
  }
}