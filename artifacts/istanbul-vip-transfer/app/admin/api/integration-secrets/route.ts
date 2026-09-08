import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import {
  INTEGRATION_CATALOG,
  isManagedIntegrationKey,
  maskSecret,
} from '@/lib/integration-secrets';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '@/lib/integration-secrets-crypto';
import { decryptSmtpPassword, encryptSmtpPassword } from '@/lib/email-settings-crypto';
import { decryptTurnstileSecret, encryptTurnstileSecret } from '@/lib/turnstile-settings-crypto';

const bodySchema = z.object({
  key: z.string(),
  value: z.string().min(1).max(4096),
});

async function superAdmin() {
  try {
    const session = await requireAdminSession();
    return session.role === 'SUPER_ADMIN' ? session : null;
  } catch { return null; }
}

export async function GET() {
  if (!await superAdmin()) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  try {
    const { db } = await import('@/db');
    const { integrationSecrets, emailSettings, turnstileSettings, gscConnections, googleAdsConnections, socialPlatforms } = await import('@/db/schema');
    const [central, email, turnstile, gsc, ads, social] = await Promise.all([
      db.select().from(integrationSecrets),
      db.select({ encrypted: emailSettings.smtpPassEncrypted }).from(emailSettings).limit(1),
      db.select({ encrypted: turnstileSettings.secretKeyEncrypted }).from(turnstileSettings).limit(1),
      db.select({ connected: gscConnections.connected }).from(gscConnections).limit(1),
      db.select({ connected: googleAdsConnections.connected }).from(googleAdsConnections).limit(1),
      db.select({ key: socialPlatforms.key, connected: socialPlatforms.connected }).from(socialPlatforms),
    ]);
    const stored = new Map(central.map(item => [item.key, item.ciphertext]));
    const entries = await Promise.all(INTEGRATION_CATALOG.map(async entry => {
      if (entry.key === 'SMTP_PASS') {
        const value = email[0]?.encrypted ? await decryptSmtpPassword(email[0].encrypted) : process.env.SMTP_PASS;
        return { ...entry, configured: !!value, source: email[0]?.encrypted ? 'existing_connection' : value ? 'environment' : 'none', masked: maskSecret(value) };
      }
      if (entry.key === 'TURNSTILE_SECRET') {
        const value = turnstile[0]?.encrypted ? await decryptTurnstileSecret(turnstile[0].encrypted) : null;
        return { ...entry, configured: !!value, source: value ? 'existing_connection' : 'none', masked: maskSecret(value) };
      }
      if (entry.key === 'WHATSAPP') return { ...entry, configured: false, source: 'none', masked: null };
      if (entry.key === 'X_ACCESS_TOKEN' || entry.key === 'X_ACCESS_TOKEN_SECRET' || entry.key === 'X_BEARER_TOKEN') {
        return { ...entry, configured: !!process.env[entry.key], source: process.env[entry.key] ? 'environment' : 'none', masked: null };
      }
      if (entry.key === 'GSC_CONNECTION') return { ...entry, configured: !!gsc[0]?.connected, source: gsc[0]?.connected ? 'existing_connection' : 'none', masked: null };
      if (entry.key === 'GOOGLE_ADS_CONNECTION') return { ...entry, configured: !!ads[0]?.connected, source: ads[0]?.connected ? 'existing_connection' : 'none', masked: null };
      if (entry.key === 'GOOGLE_BUSINESS_CONNECTION') return { ...entry, configured: !!social.find(item => item.key === 'google_business')?.connected, source: social.find(item => item.key === 'google_business')?.connected ? 'existing_connection' : 'none', masked: null };
      if (entry.key === 'META_CONNECTION') return { ...entry, configured: social.some(item => (item.key === 'facebook' || item.key === 'instagram') && item.connected), source: social.some(item => (item.key === 'facebook' || item.key === 'instagram') && item.connected) ? 'existing_connection' : 'none', masked: null };
      if (entry.key === 'X_CONNECTION') return { ...entry, configured: !!social.find(item => item.key === 'x')?.connected, source: social.find(item => item.key === 'x')?.connected ? 'existing_connection' : 'none', masked: null };
      const ciphertext = stored.get(entry.key);
      if (ciphertext) {
        const value = await decryptIntegrationSecret(ciphertext);
        return { ...entry, configured: !!value, source: 'database', masked: maskSecret(value) };
      }
      const env = process.env[entry.key];
      return { ...entry, configured: !!env, source: env ? 'environment' : 'none', masked: maskSecret(env) };
    }));
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: 'Entegrasyon durumları yüklenemedi.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limited = await rateLimit(`${ip}:integration-secrets`);
  if (!limited.success) return NextResponse.json({ error: 'Çok fazla deneme. Lütfen bekleyin.' }, { status: 429 });
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: 'Yetersiz yetki.' }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success || !isManagedIntegrationKey(parsed.data.key) || !parsed.data.value.trim()) {
    return NextResponse.json({ error: 'Geçersiz anahtar veya değer.' }, { status: 422 });
  }
  const key = parsed.data.key;
  const value = parsed.data.value.trim();
  try {
    const { db } = await import('@/db');
    const { integrationSecrets, auditLogs, emailSettings, turnstileSettings } = await import('@/db/schema');
    await db.transaction(async (tx) => {
      if (key === 'SMTP_PASS') {
        const encrypted = await encryptSmtpPassword(value);
        if (!encrypted || await decryptSmtpPassword(encrypted) !== value) throw new Error('secure_write_failed');
        await tx.insert(emailSettings).values({ id: 1, smtpPassEncrypted: encrypted, updatedAt: new Date(), updatedBy: session.adminId }).onConflictDoUpdate({ target: emailSettings.id, set: { smtpPassEncrypted: encrypted, updatedAt: new Date(), updatedBy: session.adminId } });
      } else if (key === 'TURNSTILE_SECRET') {
        const encrypted = await encryptTurnstileSecret(value);
        if (!encrypted || await decryptTurnstileSecret(encrypted) !== value) throw new Error('secure_write_failed');
        await tx.insert(turnstileSettings).values({ id: 1, secretKeyEncrypted: encrypted, updatedAt: new Date(), updatedBy: session.adminId }).onConflictDoUpdate({ target: turnstileSettings.id, set: { secretKeyEncrypted: encrypted, updatedAt: new Date(), updatedBy: session.adminId } });
      } else {
        const ciphertext = await encryptIntegrationSecret(value);
        if (!ciphertext) throw new Error('secure_write_failed');
        const row = { key, ciphertext, updatedAt: new Date(), updatedBy: session.adminId };
        await tx.insert(integrationSecrets).values(row).onConflictDoUpdate({ target: integrationSecrets.key, set: row });
      }
      await tx.insert(auditLogs).values({ adminUserId: session.adminId, action: 'INTEGRATION_SECRET_UPDATED', entityType: 'IntegrationSecret', entityId: key, metadata: { key, action: 'updated' } });
    });
    return NextResponse.json({ success: true, key });
  } catch {
    return NextResponse.json({ error: 'Değer güvenli olarak kaydedilemedi.' }, { status: 503 });
  }
}