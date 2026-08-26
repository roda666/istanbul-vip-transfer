import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidateContactSettings } from '@/lib/site-settings-server';
import { invalidateImageSettings } from '@/lib/image-settings-server';
import { revalidateTag } from 'next/cache';
import { PUBLIC_CHROME_TAG } from '@/lib/public-chrome-cache';
import { normalizeEmailLinkBaseUrl, resolveEmailLinkOrigin } from '@/lib/email-link-url';

const optionalHttpsUrl = z.preprocess(
  (value) => value === '' ? null : value,
  z.string()
    .url()
    .max(500)
    .refine((value) => new URL(value).protocol === 'https:', 'URL HTTPS ile başlamalıdır.')
    .optional()
    .nullable(),
);

const settingsSchema = z.object({
  businessName: z.string().max(200).optional().nullable(),
  logoPath: z.string().max(500).optional().nullable(),
  phoneDisplay: z.string().max(50).optional().nullable(),
  phoneInternational: z.string().max(20).optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  googleBusinessUrl: optionalHttpsUrl,
  address: z.string().max(500).optional().nullable(),
  defaultSeoTitle: z.string().max(200).optional().nullable(),
  defaultSeoDescription: z.string().max(400).optional().nullable(),
  publicSiteUrl: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().url().max(500).refine((value) => {
      const normalized = normalizeEmailLinkBaseUrl(value);
      return Boolean(normalized) && normalized === value.replace(/\/$/, '');
    }, 'Genel site adresi HTTPS olmalı; localhost, 0.0.0.0 ve port numarası içeremez.')
      .optional()
      .nullable(),
  ),
  // Legal / trust fields
  companyLegalName: z.string().max(200).optional().nullable(),
  companyTradeName: z.string().max(200).optional().nullable(),
  tursabNo: z.string().max(50).optional().nullable(),
  fullAddress: z.string().max(500).optional().nullable(),
  googlePlayUrl:   z.string().max(500).optional().nullable(),
  googleReviewUrl: optionalHttpsUrl,
  tiktokUrl:       optionalHttpsUrl,
  youtubeUrl:      optionalHttpsUrl,
  approvalGateEnabled: z.boolean().optional(),
  imageCompressionMaxKb: z.number().int().min(50).max(2000).optional(),
});

export async function GET(request: NextRequest) {
  try { await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const { db } = await import('@/db');
    const { siteSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    return NextResponse.json({
      settings: rows[0] ?? null,
      emailLinkOrigin: await resolveEmailLinkOrigin(request),
    });
  } catch (err) {
    console.error('Settings GET error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await (await import('@/lib/auth/session')).requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  if (parsed.data.approvalGateEnabled !== undefined && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Onay kapısını yalnızca hesap sahibi değiştirebilir.' }, { status: 403 });
  }

  try {
    const { db } = await import('@/db');
    const { siteSettings, auditLogs } = await import('@/db/schema');

    const [updated] = await db
      .insert(siteSettings)
      .values({ id: 1, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettings.id, set: { ...parsed.data, updatedAt: new Date() } })
      .returning();

    await db.insert(auditLogs).values({ adminUserId: session.adminId, action: 'UPDATE', entityType: 'SiteSettings', entityId: '1' }).catch(() => {});
    invalidateContactSettings(); // flush module-level cache so next request reflects updated values
    invalidateImageSettings();
    revalidateTag(PUBLIC_CHROME_TAG);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error('Settings POST error:', err);
    return NextResponse.json({ error: 'Veritabanı hatası.' }, { status: 503 });
  }
}
