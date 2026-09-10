/**
 * POST /admin/api/service-pages/check
 *
 * Manually triggers one health-check cycle (same logic as the scheduler) and
 * returns the result. Useful for testing without waiting for the next scheduled
 * run, and for verifying email delivery.
 *
 * Requires an active admin session.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { runServiceHealthCheck } from '@/lib/service-health-scheduler';
import { sendEmailDetailed } from '@/lib/email';
import 'server-only';

export async function POST() {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runServiceHealthCheck();
    if (result.status === 'skipped_missing_tables') {
      return NextResponse.json({
        ok: false,
        status: result.status,
        error: 'Health kontrol tabloları erişilemedi. Veritabanı migration durumunu kontrol edin.',
      }, { status: 503 });
    }
    if (result.status === 'failed') {
      return NextResponse.json({
        ok: false,
        status: result.status,
        error: 'Health kontrolü tamamlanamadı. Sunucu loglarını kontrol edin.',
      }, { status: 500 });
    }

    const recipient = process.env.ADMIN_EMAIL?.trim();
    if (!recipient) {
      return NextResponse.json({
        ok: false,
        status: result.status,
        unhealthyCount: result.unhealthyCount,
        error: 'Health kontrolü tamamlandı ancak ADMIN_EMAIL ayarlanmadığı için test e-postası gönderilemedi.',
      }, { status: 503 });
    }

    const delivery = await sendEmailDetailed({
      to: recipient,
      subject: 'Istanbul VIP Transfer — Health Check Test',
      html: `<p>Manuel health kontrolü tamamlandı.</p><p>Sağlıksız hizmet sayfası sayısı: <strong>${result.unhealthyCount}</strong></p>`,
      text: `Manuel health kontrolü tamamlandı. Sağlıksız hizmet sayfası sayısı: ${result.unhealthyCount}.`,
      source: 'manual-health-check',
    });
    if (!delivery.ok) {
      return NextResponse.json({
        ok: false,
        status: result.status,
        unhealthyCount: result.unhealthyCount,
        emailDelivery: delivery.code,
        error: `Health kontrolü tamamlandı ancak test e-postası teslim edilemedi: ${delivery.message}`,
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      unhealthyCount: result.unhealthyCount,
      emailDelivery: delivery.code,
      message: 'Health kontrolü tamamlandı; test e-postası SMTP sunucusu tarafından ADMIN_EMAIL alıcısı için kabul edildi.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
