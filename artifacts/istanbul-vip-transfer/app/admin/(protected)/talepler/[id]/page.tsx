import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import TalepDetayClient from './_TalepDetayClient';

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

    const rows = await db
      .select()
      .from(reservationRequests)
      .where(eq(reservationRequests.id, id))
      .limit(1);

    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı / Şehir İçi Transfer',
  INTERCITY:        'Şehirler Arası Transfer',
  ALLOCATION:       'Araç Tahsisi',
  TOUR:             'Özel Tur / Gezi',
};

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

const row: React.CSSProperties = {
  display: 'flex',
  padding: '10px 0',
  borderBottom: '1px solid #F1F5F9',
  gap: '12px',
  fontFamily: 'Inter, sans-serif',
};

const label: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94A3B8',
  minWidth: '160px',
  flexShrink: 0,
};

const value: React.CSSProperties = {
  fontSize: '13px',
  color: '#1E293B',
  flex: 1,
};

export default async function TalepDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await getRequest(id);
  if (!req) notFound();

  const formData = (req.requestData as Record<string, unknown>) ?? {};

  return (
    <div style={{ padding: '28px 24px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/admin/talepler"
          style={{ fontSize: '13px', color: '#2563EB', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}
        >
          ← Tüm Talepler
        </Link>
      </div>
      <AdminPageHeader
        title={req.referenceNumber}
        description={`${req.intent === 'QUOTE' ? 'Fiyat Teklifi' : 'Rezervasyon'} · ${SERVICE_LABELS[req.serviceType] ?? req.serviceType}`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>

        {/* Contact info */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>İletişim</h3>
          <div style={row}><span style={label}>Ad Soyad</span><span style={value}>{req.name}</span></div>
          <div style={row}><span style={label}>Telefon</span><span style={value}>{req.phone}</span></div>
          <div style={row}><span style={label}>E-posta</span><span style={value}>{req.normalizedEmail ?? '—'}</span></div>
          <div style={{ ...row, borderBottom: 'none' }}><span style={label}>Kayıt Tarihi</span><span style={value}>{formatDate(req.createdAt)}</span></div>
        </div>

        {/* Status */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>Durum</h3>
          <TalepDetayClient requestId={req.id} currentStatus={req.status} archivedAt={req.archivedAt?.toISOString() ?? null} />
        </div>

        {/* Service-specific data */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#102A43', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>Talep Detayları</h3>
          {Object.entries(formData).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => (
            <div key={k} style={row}>
              <span style={label}>{k}</span>
              <span style={value}>{String(v)}</span>
            </div>
          ))}
          {Object.keys(formData).length === 0 && (
            <p style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Detay verisi yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
