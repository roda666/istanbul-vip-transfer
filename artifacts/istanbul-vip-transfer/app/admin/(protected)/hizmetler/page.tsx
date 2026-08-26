import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/db';
import { content, contentTranslations, serviceHealthRuns } from '@/db/schema';
import { eq, asc, desc, inArray, and } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import {
  computeServiceHealthIssues,
  getRegisteredServiceSlugs,
  type ServiceDbRow,
  type ServiceHealthItem,
} from '@/lib/service-page-health';
import RunHealthCheckButton from './_RunHealthCheckButton';
import BulkRetranslateButton from './_BulkRetranslateButton';
import HizmetlerList, { type ServiceListItem } from './_HizmetlerList';
import { getServiceStartingPriceEur } from '@/lib/service-starting-price';

export const metadata: Metadata = { title: 'Hizmetler | Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

const ISSUE_LABELS: Record<string, string> = {
  missing_record:      'Veritabanında kayıt yok',
  inactive:            'Pasif (is_active=false)',
  not_published:       'Yayında değil',
  body_missing:        'Gövde içeriği eksik',
  body_invalid_schema: 'Gövde şema hatası (ServicePageBody değil)',
};

export default async function HizmetlerPage() {
  let items: ServiceListItem[]     = [];
  let dbError                      = false;
  let healthIssues: ServiceHealthItem[] = [];
  let lastCheckedAt: Date | null   = null;

  try {
    // ── 1. Fetch all SERVICE rows ─────────────────────────────────────────────
    const rows = await db
      .select({
        id:             content.id,
        title:          content.title,
        slug:           content.slug,
        status:         content.status,
        isActive:       content.isActive,
        displayOrder:   content.displayOrder,
        category:       content.category,
        showOnHomepage: content.showOnHomepage,
        showInNav:      content.showInNav,
        heroImage:      content.heroImage,
        updatedAt:      content.updatedAt,
        body:           content.body,
      })
      .from(content)
      .where(eq(content.contentType, 'SERVICE'))
      .orderBy(asc(content.displayOrder), asc(content.createdAt));

    // ── 2. Fetch translation statuses ─────────────────────────────────────────
    const ids = rows.map(r => r.id);
    let txRows: { entityId: string; locale: string; status: string }[] = [];
    if (ids.length > 0) {
      txRows = await db
        .select({
          entityId: contentTranslations.entityId,
          locale:   contentTranslations.targetLanguageCode,
          status:   contentTranslations.status,
        })
        .from(contentTranslations)
        .where(and(
          eq(contentTranslations.entityType, 'service_page'),
          inArray(contentTranslations.entityId, ids),
        ));
    }

    // Group translations: serviceId → { locale: status }
    const txByService = new Map<string, Record<string, string>>();
    for (const tx of txRows) {
      if (!txByService.has(tx.entityId)) txByService.set(tx.entityId, {});
      txByService.get(tx.entityId)![tx.locale] = tx.status;
    }

    // ── 3. Build list items ───────────────────────────────────────────────────
    const priceBySlug = new Map<string, number | null>(
      await Promise.all(
        rows.map(async r => [r.slug, await getServiceStartingPriceEur(r.slug)] as const),
      ),
    );

    items = rows.map(r => ({
      id:             r.id,
      title:          r.title,
      slug:           r.slug,
      status:         r.status,
      isActive:       r.isActive,
      displayOrder:   r.displayOrder,
      category:       r.category,
      showOnHomepage: r.showOnHomepage,
      showInNav:      r.showInNav,
      heroImage:      r.heroImage,
      updatedAt:      r.updatedAt.toISOString(),
      translations:   txByService.get(r.id) ?? {},
      startingPriceEur: priceBySlug.get(r.slug) ?? null,
    }));

    // ── 4. Health check ───────────────────────────────────────────────────────
    const dbRows: ServiceDbRow[] = rows.map(r => ({
      id:       r.id,
      slug:     r.slug,
      title:    r.title,
      status:   r.status,
      isActive: r.isActive,
      body:     r.body ?? null,
    }));
    healthIssues = computeServiceHealthIssues(getRegisteredServiceSlugs(), dbRows);

    const lastRun = await db
      .select({ checkedAt: serviceHealthRuns.checkedAt })
      .from(serviceHealthRuns)
      .orderBy(desc(serviceHealthRuns.checkedAt))
      .limit(1);
    lastCheckedAt = lastRun[0]?.checkedAt ?? null;
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Hizmet Sayfaları"
        description="CMS ile tüm hizmet sayfalarını yönetin. Türkçe kaydedin — EN, DE, RU, AR, FR, ES, IT, NL otomatik çevrilir."
      />

      {/* ── Health warning banner ─────────────────────────────────────────── */}
      {healthIssues.length > 0 && (
        <div style={{
          marginBottom: '20px', padding: '14px 18px',
          background: '#FFF7ED', border: '1px solid #FBBF24',
          borderRadius: '10px', fontFamily: 'Inter, sans-serif',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
            ⚠️ {healthIssues.length} hizmet sayfasında sorun tespit edildi
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {healthIssues.map(h => (
              <li key={h.slug} style={{ fontSize: '12px', color: '#B45309', marginBottom: '4px' }}>
                <strong>{h.title ?? h.slug}</strong>{h.title ? ` (${h.slug})` : ''} —{' '}
                {h.issues.map(code => ISSUE_LABELS[code] ?? code).join(', ')}
              </li>
            ))}
          </ul>
          <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#92400E' }}>
            Bu sayfalar ziyaretçilere hata (404/boş sayfa) gösterebilir.
            İlgili sayfayı düzenleyip aktif &amp; yayında duruma getirin.
          </p>
        </div>
      )}

      {/* ── Scheduler status bar ──────────────────────────────────────────── */}
      <div style={{
        marginBottom: '20px', padding: '12px 16px',
        background: '#F8FAFC', border: '1px solid #E2E8F0',
        borderRadius: '10px', fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>🕐 Otomatik kontrol:</span>
          {lastCheckedAt ? (
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
              {new Intl.DateTimeFormat('tr-TR', {
                dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul',
              }).format(lastCheckedAt)}
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>
              Henüz çalışmadı — sunucu başladıktan ~30 saniye sonra ilk kontrol yapılır.
            </span>
          )}
        </div>
        <RunHealthCheckButton />
        <BulkRetranslateButton />
        <Link href="/admin/hizmetler/yeni" style={{
          background: '#C9A84C', color: '#0A0A0A', textDecoration: 'none',
          borderRadius: '8px', padding: '8px 16px', fontSize: '12px',
          fontWeight: 700, fontFamily: 'Inter, sans-serif', flexShrink: 0,
        }}>
          + Yeni Hizmet
        </Link>
      </div>

      {dbError ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası.
        </p>
      ) : (
        <HizmetlerList items={items} />
      )}
    </div>
  );
}
