'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { SOURCE_FILTER_OPTIONS, formatSource } from '@/lib/source-labels';
import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';

/** Registry-derived: automatically updated when locales change. */
const LOCALE_REGISTRY_CODES = LOCALE_REGISTRY.map((l) => l.code);

interface Subscriber {
  id: string;
  normalizedEmail: string;
  name: string | null;
  preferredLanguage: string;
  status: string;
  source: string;
  createdAt: string;
  consentVersion: string | null;
  consentAction:  string | null;
  consentDate:    string | null;
}

interface PageResult {
  rows: Subscriber[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:      'Beklemede',
  ACTIVE:       'Aktif',
  UNSUBSCRIBED: 'Abonelik İptal',
  SUPPRESSED:   'Engellendi',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:      { bg: '#FFFBEB', text: '#B45309' },
  ACTIVE:       { bg: '#F0FDF4', text: '#15803D' },
  UNSUBSCRIBED: { bg: '#F1F5F9', text: '#64748B' },
  SUPPRESSED:   { bg: '#FFF1F2', text: '#BE123C' },
};

const CONSENT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  GRANTED:   { label: 'Rıza Verildi',  color: '#15803D' },
  WITHDRAWN: { label: 'Rıza Geri Alındı', color: '#BE123C' },
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
  const [search, setSearch]   = useState('');
  const [source, setSource]   = useState('');
  const [updating, setUpdating]   = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      if (lang)   params.set('lang', lang);
      if (source) params.set('source', source);
      if (search) params.set('search', search);
      const res = await fetch(`/admin/api/newsletter?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('Aboneler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [page, status, lang, source, search]);

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
  async function sendNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setSendMessage('');
    try {
      const res = await fetch('/admin/api/newsletter/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, html: message, text: message.replace(/<[^>]*>/g, '') }) });
      const body = await res.json();
      const r = body.result;
      setSendMessage(body.error ?? `Gönderim sonucu: ${r.acceptedCount}/${r.recipientCount} alıcı kabul edildi.${r.failureCodes?.length ? ` Hatalar: ${r.failureCodes.join(', ')}` : ''}`);
      if (res.ok) { setSubject(''); setMessage(''); }
    } catch { setSendMessage('Sunucu hatası.'); } finally { setSending(false); }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  }

  function formatDateTime(iso: string) {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
    fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFFFFF', color: '#1E293B',
  };

  return (
    <div>
      <form onSubmit={sendNewsletter} style={{ padding: '16px', marginBottom: '20px', border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff' }}>
        <strong style={{ fontFamily: 'Inter, sans-serif', color: '#1E293B' }}>Aktif abonelere bülten gönder</strong>
        <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
          <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Konu" maxLength={200} style={inputStyle} />
          <textarea required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mesaj (HTML kullanılabilir)" maxLength={100000} rows={6} style={inputStyle} />
          <div style={{ fontSize: '12px', color: '#64748B' }}>Her e-postaya tek kullanımlık abonelikten ayrılma bağlantısı eklenir. Yalnızca Aktif aboneler alır.</div>
          <div><button disabled={sending} style={{ ...inputStyle, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{sending ? 'Gönderiliyor…' : 'Bülteni Gönder'}</button></div>
          {sendMessage && <div style={{ fontSize: '13px', color: sendMessage.includes('sonucu') ? '#15803D' : '#BE123C' }}>{sendMessage}</div>}
        </div>
      </form>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>

        {/* Email search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="E-posta ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={lang} onChange={(e) => { setLang(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Diller</option>
          {LOCALE_REGISTRY_CODES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>

        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Kaynaklar</option>
          {SOURCE_FILTER_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
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
                    <th style={th}>Rıza Durumu</th>
                    <th style={th}>Rıza Tarihi</th>
                    <th style={th}>Kayıt Tarihi</th>
                    <th style={th}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '40px' }}>Kayıt bulunamadı.</td></tr>
                  )}
                  {data.rows.map((sub) => {
                    const sc = STATUS_COLORS[sub.status] ?? STATUS_COLORS.PENDING;
                    const consent = sub.consentAction ? CONSENT_ACTION_LABELS[sub.consentAction] : null;
                    return (
                      <tr key={sub.id}>
                        <td style={{ ...td, fontFamily: 'mono, monospace', fontSize: '12px' }}>{sub.normalizedEmail}</td>
                        <td style={td}>{sub.name ?? '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{sub.preferredLanguage.toUpperCase()}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>{formatSource(sub.source)}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: '12px' }}>
                          {consent ? (
                            <span style={{ color: consent.color, fontWeight: 600 }}>{consent.label}</span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>
                          {sub.consentDate ? formatDateTime(sub.consentDate) : '—'}
                        </td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>{formatDate(sub.createdAt)}</td>
                        <td style={td}>
                          {sub.status !== 'UNSUBSCRIBED' && sub.status !== 'SUPPRESSED' && (
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
