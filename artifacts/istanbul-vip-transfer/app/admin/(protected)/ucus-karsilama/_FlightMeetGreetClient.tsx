'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plane, RefreshCw, ShieldAlert } from 'lucide-react';

type FeatureStatus = {
  enabled: boolean;
  provider: { id: string; label: string; configured: boolean };
  lookupReady: boolean;
};

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '12px',
  padding: '22px',
  boxShadow: '0 3px 12px rgba(23,43,58,0.04)',
};

export default function FlightMeetGreetClient() {
  const [status, setStatus] = useState<FeatureStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/admin/api/flight-meet-greet', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.status) {
        setError(payload.error ?? 'Durum bilgisi alınamadı.');
        return;
      }
      setStatus(payload.status);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closed = status?.enabled !== true;
  return (
    <div style={{ maxWidth: '780px', display: 'grid', gap: '16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ ...CARD, borderColor: closed ? '#F0C36A' : '#F2B8B5', background: closed ? '#FFFBEB' : '#FEF2F2' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <ShieldAlert size={23} color={closed ? '#A16207' : '#B42318'} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <h2 style={{ margin: 0, color: '#172B3A', fontSize: '16px' }}>
              {closed ? 'Özellik kapalı' : 'Özellik açık, ancak kullanıma hazır değil'}
            </h2>
            <p style={{ margin: '7px 0 0', color: '#52697A', fontSize: '13px', lineHeight: 1.55 }}>
              Uçuş numarası alanı, uçuş sonucu ve sağlayıcı bağlantısı public sitede gösterilmez. Sağlayıcı kurulana kadar uçuş sorgusu başlatılamaz.
            </p>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={{ margin: 0, color: '#172B3A', fontSize: '16px' }}>Hazırlık durumu</h2>
        {loading && <p style={{ color: '#52697A', fontSize: '13px' }}>Durum yükleniyor…</p>}
        {error && <p role="alert" style={{ color: '#B42318', fontSize: '13px' }}>{error}</p>}
        {status && (
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 0.42fr) 1fr', gap: '13px 20px', margin: '20px 0 0', fontSize: '13px' }}>
            <dt style={{ color: '#52697A', fontWeight: 700 }}>Özellik bayrağı</dt>
            <dd style={{ margin: 0, color: status.enabled ? '#B42318' : '#18794E', fontWeight: 700 }}>{status.enabled ? 'Açık' : 'Kapalı'}</dd>
            <dt style={{ color: '#52697A', fontWeight: 700 }}>Uçuş sağlayıcısı</dt>
            <dd style={{ margin: 0, color: '#172B3A' }}>{status.provider.label}</dd>
            <dt style={{ color: '#52697A', fontWeight: 700 }}>Sorgu durumu</dt>
            <dd style={{ margin: 0, color: status.lookupReady ? '#18794E' : '#A16207', fontWeight: 700 }}>{status.lookupReady ? 'Hazır' : 'Kullanıma kapalı'}</dd>
          </dl>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{ marginTop: '22px', display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1px solid #C8D4DE', background: '#FFFFFF', color: '#172B3A', borderRadius: '7px', padding: '8px 11px', fontSize: '13px', cursor: loading ? 'wait' : 'pointer' }}
        >
          <RefreshCw size={15} /> Durumu yenile
        </button>
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Plane size={20} color="#2563EB" />
          <h2 style={{ margin: 0, color: '#172B3A', fontSize: '16px' }}>Açılış için gerekenler</h2>
        </div>
        <ul style={{ margin: '15px 0 0', paddingLeft: '20px', color: '#52697A', fontSize: '13px', lineHeight: 1.75 }}>
          <li>Onaylanmış bir uçuş veri sağlayıcısı ve yalnızca sunucuda saklanan erişim bilgisi</li>
          <li>Sağlayıcı adaptörünün güvenli hata ve gecikme kontrolleri</li>
          <li>Public rezervasyon deneyiminin ayrıca onaylanmış bir sürümü</li>
        </ul>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#18794E', fontSize: '13px' }}>
          <CheckCircle2 size={17} /> Bu aşamada hiçbir sağlayıcı anahtarı tarayıcıya gönderilmez.
        </div>
      </div>
    </div>
  );
}