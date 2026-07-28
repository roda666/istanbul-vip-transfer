'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';

interface Subscriber {
  id: string;
  normalizedEmail: string;
  name: string | null;
  preferredLanguage: string;
  status: 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED';
  source: string;
  createdAt: string;
  consentDate?: string | null;
  consentVersion?: string | null;
}

interface PageResult {
  rows: Subscriber[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:       'Beklemede',
  ACTIVE:        'Aktif',
  UNSUBSCRIBED:  'Abonelik İptal',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:      { bg: '#FFFBEB', text: '#B45309' },
  ACTIVE:       { bg: '#F0FDF4', text: '#15803D' },
  UNSUBSCRIBED: { bg: '#F1F5F9', text: '#64748B' },
};

const td: React.CSSProperties = {
  padding: '12px 14px', fontSize: '13px', color: '#1E293B',
  fontFamily: 'Inter, sans-serif', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle',
};

const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.08em', color: '#64748B', background: '#F8FAFC',
  borderBottom: '2px solid #E2E8F0', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
};

export default function AbonelerClient() {
  const [data, setData]       = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState('');
  const [lang, setLang]       = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(status && { status }),
        ...(lang   && { lang }),
      });
      const res = await fetch(`/admin/api/newsletter?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('Aboneler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [page, status, lang]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function unsubscribe(id: string) {
    if (!confirm('Bu aboneyi listeden çıkarmak istediğinize emin misiniz?')) return;
    setUpdating(id);
    try {
      await fetch(`/admin/api/newsletter/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNSUBSCRIBED' }),
      });
      fetchData();
    } finally {
      setUpdating(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch('/admin/api/newsletter-export');
      if (!res.ok) return alert('CSV dışa aktarımı başarısız.');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `bulten-aboneleri-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
    fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFFFFF', color: '#1E293B',
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={lang} onChange={(e) => { setLang(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Diller</option>
          {['tr', 'en', 'de', 'ru', 'ar'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>

        <button onClick={fetchData} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Yenile
        </button>

        <button
          onClick={exportCsv}
          disabled={exporting}
          style={{
            ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            background: '#2563EB', color: '#FFFFFF', border: 'none', fontWeight: 600,
          }}
        >
          <Download size={13} /> {exporting ? 'Hazırlanıyor…' : 'CSV İndir (Rızalılar)'}
        </button>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading && <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Yükleniyor…</div>}
        {error   && <div style={{ padding: '24px', color: '#DC2626', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{error}</div>}
        {!loading && !error && data && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>E-posta</th>
                    <th style={th}>İsim</th>
                    <th style={th}>Dil</th>
                    <th style={th}>Kaynak</th>
                    <th style={th}>Durum</th>
                    <th style={th}>Rıza Versiyonu</th>
                    <th style={th}>Kayıt Tarihi</th>
                    <th style={th}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '40px' }}>Kayıt bulunamadı.</td></tr>
                  )}
                  {data.rows.map((sub) => {
                    const sc = STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING;
                    return (
                      <tr key={sub.id}>
                        <td style={{ ...td, fontFamily: 'mono, monospace', fontSize: '12px' }}>{sub.normalizedEmail}</td>
                        <td style={td}>{sub.name ?? '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{sub.preferredLanguage.toUpperCase()}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>{sub.source}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>{sub.consentVersion ?? '—'}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>{formatDate(sub.createdAt)}</td>
                        <td style={td}>
                          {sub.status !== 'UNSUBSCRIBED' && (
                            <button
                              onClick={() => unsubscribe(sub.id)}
                              disabled={!!updating}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', border: '1px solid #FECDD3',
                                background: '#FFF1F2', color: '#BE123C', fontSize: '11px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              Aboneliği İptal Et
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>Toplam {data.total} abone</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>←</button>
                  <span style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>{page} / {data.totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
