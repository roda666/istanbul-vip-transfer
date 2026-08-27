import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import TalepDetayClient from './_TalepDetayClient';
import { formatRequestPage, formatSource } from '@/lib/source-labels';

export const metadata: Metadata = {
  title: 'Talep Detayı | Admin',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

async function getRequest(id: string) {
  try {
    const { db } = await import('@/db');
    const { reservationRequests } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(reservationRequests).where(eq(reservationRequests.id, id)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function getAuditLog(entityId: string) {
  try {
    const { db } = await import('@/db');
    const { auditLogs, adminUsers } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');
    return await db
      .select({
        id:        auditLogs.id,
        action:    auditLogs.action,
        metadata:  auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        adminName: adminUsers.name,
      })
      .from(auditLogs)
      .leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id))
      .where(eq(auditLogs.entityId, entityId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
  } catch {
    return [];
  }
}

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER:  'Havalimanı / Şehir İçi Transfer',
  INTERCITY:         'Şehirler Arası Transfer',
  ALLOCATION:        'Araç Tahsisi',
  TOUR:              'Özel Tur / Gezi',
  CONTACT_INQUIRY:   '📩 İletişim Talebi',
};

/** Maps raw JSON form keys to human-readable Turkish labels. */
const FIELD_LABELS: Record<string, string> = {
  tarih:             'Tarih',
  saatSaat:          'Saat',
  saatDakika:        'Dakika',
  yolcuSayisi:       'Yolcu Sayısı',
  adSoyad:           'Ad Soyad',
  telefon:           'Telefon',
  email:             'E-posta',
  alisLokasyonu:     'Alış Lokasyonu',
  alisAdresi:        'Alış Adresi',
  varisLokasyonu:    'Varış Lokasyonu',
  varisAdresi:       'Varış Adresi',
  ucusNumarasi:      'Uçuş Numarası',
  bagajSayisi:       'Bagaj Sayısı',
  seyahatYonu:       'Yön',
  kalkisIli:         'Kalkış İli',
  kalkisAdres:       'Kalkış Adresi',
  varisIli:          'Varış İli',
  varisAdres:        'Varış Adresi',
  tahsisSuresi:      'Tahsis Süresi',
  tahsisSuresiUnit:  'Süre Birimi',
  rotaAciklama:      'Rota Açıklaması',
  talepsRota:        'Tur Rotası',
  talepsYerler:      'Ziyaret Yerleri',
  planlananSure:     'Planlanan Süre',
  planlananSureUnit: 'Süre Birimi',
  vehiclePreference: 'Araç Tercihi',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  UPDATE:       'Durum Güncellendi',
  UPDATE_NOTES: 'Not Eklendi/Güncellendi',
  ARCHIVE:      'Arşivlendi',
  CREATE:       'Oluşturuldu',
};

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

function formatShort(d: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

const STATUS_TR: Record<string, string> = {
  NEW:       'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED:    'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  SPAM:      'Spam',
  ARCHIVED:  'Arşivlendi',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  padding: '10px 0',
  borderBottom: '1px solid #F1F5F9',
  gap: '12px',
  fontFamily: 'Inter, sans-serif',
};
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: '#94A3B8', minWidth: '160px', flexShrink: 0,
};
const valueStyle: React.CSSProperties = {
  fontSize: '13px', color: '#1E293B', flex: 1,
};

export default async function TalepDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [req, auditEntries, siteSettings] = await Promise.all([
    getRequest(id),
    getAuditLog(id),
    import('@/lib/site-settings-server').then(m => m.getContactSettings()),
  ]);
  if (!req) notFound();

  const formData = (req.requestData as Record<string, unknown>) ?? {};
  // Filter out empty values and internal fields
  const displayFields = Object.entries(formData).filter(([k, v]) =>
    v !== null && v !== '' && v !== undefined
      && k !== '_hp' && k !== 'emailNotification' && k !== 'vehiclePreferenceId',
  );
  const emailNotification = (
    typeof formData.emailNotification === 'object'
    && formData.emailNotification !== null
    && !Array.isArray(formData.emailNotification)
  ) ? formData.emailNotification as Record<string, unknown> : null;
  const emailNotificationLabel = emailNotification?.status === 'sent'
    ? 'SMTP kabul edildi'
    : emailNotification?.status === 'partial'
      ? 'Kısmen kabul edildi'
      : emailNotification?.status === 'not-configured'
        ? 'SMTP / bildirim adresi yapılandırılmamış'
        : emailNotification?.status === 'failed'
          ? 'SMTP bildirimi başarısız'
          : emailNotification?.status === 'pending'
            ? 'Gönderim sonucu bekleniyor veya kaydedilemedi'
          : 'Henüz kontrol edilmedi';

  return (
    <div style={{ padding: '28px 24px', maxWidth: '960px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin/talepler" style={{ fontSize: '13px', color: '#2563EB', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
          ← Tüm Talepler
        </Link>
      </div>
      <AdminPageHeader
        title={req.referenceNumber}
        description={`${req.intent === 'QUOTE' ? 'Fiyat Teklifi' : 'Rezervasyon'} · ${SERVICE_LABELS[req.serviceType] ?? req.serviceType}`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px', marginTop: '24px' }}>

        {/* Contact info */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
            İletişim Bilgileri
          </h3>
          <div style={rowStyle}><span style={labelStyle}>Ad Soyad</span><span style={valueStyle}>{req.name}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Telefon</span><span style={valueStyle}>{req.phone}</span></div>
          <div style={rowStyle}><span style={labelStyle}>E-posta</span><span style={valueStyle}>{req.normalizedEmail ?? '—'}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Dil</span><span style={valueStyle}>{req.locale?.toUpperCase() ?? 'TR'}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Kaynak</span><span style={valueStyle}>{formatSource(req.source)}</span></div>
           <div style={rowStyle}><span style={labelStyle}>Gönderen Sayfa</span><span style={valueStyle}>{formatRequestPage(req.pageSlug)}</span></div>
           {req.source === 'contact-form' && emailNotification && (
             <div style={rowStyle}>
               <span style={labelStyle}>E-posta Bildirimi</span>
               <span style={{
                 ...valueStyle,
                 color: emailNotification.status === 'sent' ? '#168C5B' : '#B45309',
                 fontWeight: 600,
               }}>
                 {emailNotificationLabel}
                 {typeof emailNotification.acceptedCount === 'number' && typeof emailNotification.recipientCount === 'number'
                   ? ` (${emailNotification.acceptedCount}/${emailNotification.recipientCount})`
                   : ''}
               </span>
             </div>
           )}
          <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={labelStyle}>Kayıt Tarihi</span><span style={valueStyle}>{formatDate(req.createdAt)}</span></div>
        </div>

        {/* Status + actions */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
            Durum ve İşlemler
          </h3>
          <TalepDetayClient
            requestId={req.id}
            currentStatus={req.status}
            archivedAt={req.archivedAt?.toISOString() ?? null}
            customerName={req.name}
            customerPhone={req.phone}
            referenceNumber={req.referenceNumber}
            adminNotes={req.adminNotes ?? null}
            googleReviewUrl={siteSettings.googleReviewUrl}
            isTestData={req.isTestData}
          />
        </div>

        {/* Service-specific data */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
            Talep Detayları
          </h3>
          {displayFields.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Detay verisi yok.</p>
          ) : (
            <div style={{ columns: 2, columnGap: '24px' }}>
              {displayFields.map(([k, v]) => (
                <div key={k} style={{ ...rowStyle, breakInside: 'avoid' }}>
                  <span style={labelStyle}>{FIELD_LABELS[k] ?? k}</span>
                  <span style={valueStyle}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status history / Audit log */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '16px' }}>
            Durum Geçmişi
          </h3>
          {auditEntries.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Henüz kayıt yok.</p>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: '#E2E8F0' }} aria-hidden="true" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {auditEntries.map((entry) => {
                  const meta = (entry.metadata as Record<string, string> | null) ?? {};
                  let description = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
                  if (entry.action === 'UPDATE' && meta.from && meta.to) {
                    description = `Durum değiştirildi: ${STATUS_TR[meta.from] ?? meta.from} → ${STATUS_TR[meta.to] ?? meta.to}`;
                  }
                  return (
                    <div key={entry.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', paddingLeft: '24px', position: 'relative' }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: 0, top: '4px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: entry.action === 'ARCHIVE' ? '#FFF1F2' : entry.action === 'UPDATE' ? '#EFF6FF' : '#F0FDF4',
                        border: `2px solid ${entry.action === 'ARCHIVE' ? '#FECDD3' : entry.action === 'UPDATE' ? '#BFDBFE' : '#BBF7D0'}`,
                        flexShrink: 0,
                      }} aria-hidden="true" />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', color: '#1E293B', fontFamily: 'Inter, sans-serif', margin: 0, fontWeight: 500 }}>
                          {description}
                        </p>
                        <p style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', margin: '2px 0 0' }}>
                          {formatShort(entry.createdAt)}
                          {entry.adminName ? ` · ${entry.adminName}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
