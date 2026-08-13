'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, Archive, RefreshCw } from 'lucide-react';
import { SOURCE_FILTER_OPTIONS, formatSource } from '@/lib/source-labels';

interface RequestRow {
  id: string;
  referenceNumber: string;
  intent: 'QUOTE' | 'RESERVATION';
  serviceType: string;
  name: string;
  phone: string;
  normalizedEmail: string | null;
  locale: string;
  source: string;
  status: string;
  createdAt: string;
  archivedAt: string | null;
}

interface PageResult {
  rows: RequestRow[];
  total: number;
  page: number;
  totalPages: number;
}

// Workflow statuses available for new selections
const WORKFLOW_STATUSES: Record<string, string> = {
  NEW:       'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED:    'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  CANCELLED: 'İptal',
  ARCHIVED:  'Arşivlendi',
};

// All possible display labels (including legacy values)
const STATUS_LABELS: Record<string, string> = {
  ...WORKFLOW_STATUSES,
  COMPLETED: 'Tamamlandı',
  SPAM:      'Spam',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NEW:       { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  CONTACTED: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  QUOTED:    { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  CONFIRMED: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  COMPLETED: { bg: '#F8FAFC', text: '#334155', border: '#CBD5E1' },
  CANCELLED: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  SPAM:      { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
  ARCHIVED:  { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı',
  INTERCITY:        'Şehirler Arası',
  ALLOCATION:       'Araç Tahsisi',
  TOUR:             'Özel Tur',
};

const INTENT_LABELS: Record<string, string> = {
  QUOTE:       'Fiyat Teklifi',
  RESERVATION: 'Rezervasyon',
};

import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';

/** Registry-derived: automatically includes any new locale added to locale-registry.ts */
const LOCALE_LABELS: Record<string, string> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, l.code.toUpperCase()])
);

const td: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#1E293B',
  fontFamily: 'Inter, sans-serif',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle',
};

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748B',
  background: '#F8FAFC',
  borderBottom: '2px solid #E2E8F0',
  fontFamily: 'Inter, sans-serif',
  whiteSpace: 'nowrap',
};

export default function TaleplerClient() {
  const [data, setData]         = useState<PageResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [service, setService]   = useState('');
  const [intent, setIntent]     = useState('');
  const [lang, setLang]         = useState('');
  const [source, setSource]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search)   params.set('search',    search);
      if (status)   params.set('status',    status);
      if (service)  params.set('service',   service);
      if (intent)   params.set('intent',    intent);
      if (lang)     params.set('lang',      lang);
      if (source)   params.set('source',    source);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to',   dateTo);
      const res = await fetch(`/admin/api/requests?${params}`);
      if (!res.ok) throw new Error('Yüklenemedi');
      setData(await res.json());
    } catch {
      setError('Talepler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, service, intent, lang, source, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateStatus(id: string, newStatus: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/admin/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchData();
    } finally {
      setUpdating(null);
    }
  }

  async function archiveRequest(id: string) {
    if (!confirm('Bu talebi arşivlemek istediğinize emin misiniz?')) return;
    setUpdating(id);
    try {
      const res = await fetch(`/admin/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      if (res.ok) fetchData();
    } finally {
      setUpdating(null);
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  }

  function resetFilters() {
    setSearch(''); setStatus(''); setService(''); setIntent('');
    setLang(''); setSource(''); setDateFrom(''); setDateTo('');
    setPage(1);
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
    background: '#FFFFFF',
    color: '#1E293B',
    outline: 'none',
  };

  const hasActiveFilters = search || status || service || intent || lang || source || dateFrom || dateTo;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Ref., isim, telefon, e-posta…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={service} onChange={(e) => { setService(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Hizmetler</option>
          {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={intent} onChange={(e) => { setIntent(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Talepler</option>
          <option value="QUOTE">Fiyat Teklifi</option>
          <option value="RESERVATION">Rezervasyon</option>
        </select>

        <select value={lang} onChange={(e) => { setLang(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Diller</option>
          {Object.entries(LOCALE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Tüm Kaynaklar</option>
          {SOURCE_FILTER_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Başlangıç:
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            style={{ ...inputStyle, padding: '6px 10px' }}
          />
        </label>
        <label style={{ fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Bitiş:
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            style={{ ...inputStyle, padding: '6px 10px' }}
          />
        </label>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            style={{ ...inputStyle, cursor: 'pointer', color: '#DC2626', borderColor: '#FECACA', background: '#FFF5F5' }}
          >
            Filtreleri Temizle
          </button>
        )}

        <button
          onClick={fetchData}
          style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={13} /> Yenile
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
            Yükleniyor…
          </div>
        )}
        {error && (
          <div style={{ padding: '24px', color: '#DC2626', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{error}</div>
        )}
        {!loading && !error && data && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Referans</th>
                    <th style={th}>İsim</th>
                    <th style={th}>Telefon</th>
                    <th style={th}>Dil</th>
                    <th style={th}>Kaynak</th>
                    <th style={th}>Hizmet</th>
                    <th style={th}>Talep</th>
                    <th style={th}>Durum</th>
                    <th style={th}>Kayıt Tarihi</th>
                    <th style={th}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '40px' }}>
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((row) => {
                    const sc = STATUS_COLORS[row.status] ?? STATUS_COLORS.NEW;
                    const isLegacyStatus = row.status === 'COMPLETED' || row.status === 'SPAM';
                    return (
                      <tr key={row.id} style={{ opacity: row.archivedAt ? 0.55 : 1 }}>
                        <td style={td}>
                          <Link
                            href={`/admin/talepler/${row.id}`}
                            style={{ color: '#2563EB', textDecoration: 'none', fontFamily: 'mono, monospace', fontSize: '12px', fontWeight: 600 }}
                          >
                            {row.referenceNumber}
                          </Link>
                        </td>
                        <td style={td}>{row.name}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#475569' }}>{row.phone}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                          }}>
                            {LOCALE_LABELS[row.locale] ?? row.locale.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B' }}>
                          {formatSource(row.source)}
                        </td>
                        <td style={{ ...td, fontSize: '12px' }}>{SERVICE_LABELS[row.serviceType] ?? row.serviceType}</td>
                        <td style={{ ...td, fontSize: '12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            background: row.intent === 'QUOTE' ? '#EFF6FF' : '#F0FDF4',
                            color:      row.intent === 'QUOTE' ? '#1D4ED8' : '#15803D',
                            border:     `1px solid ${row.intent === 'QUOTE' ? '#BFDBFE' : '#BBF7D0'}`,
                          }}>
                            {INTENT_LABELS[row.intent] ?? row.intent}
                          </span>
                        </td>
                        <td style={td}>
                          {isLegacyStatus ? (
                            // Legacy statuses shown read-only, not selectable
                            <span style={{
                              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                              border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text,
                              display: 'inline-block',
                            }}>
                              {STATUS_LABELS[row.status]}
                            </span>
                          ) : (
                            <select
                              value={row.status}
                              disabled={!!updating || !!row.archivedAt}
                              onChange={(e) => updateStatus(row.id, e.target.value)}
                              style={{
                                padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text,
                                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              {Object.entries(WORKFLOW_STATUSES).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {formatDate(row.createdAt)}
                        </td>
                        <td style={{ ...td }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <Link
                              href={`/admin/talepler/${row.id}`}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                background: '#EFF6FF', color: '#2563EB', textDecoration: 'none',
                              }}
                            >
                              Detay
                            </Link>
                            {!row.archivedAt && (
                              <button
                                onClick={() => archiveRequest(row.id)}
                                disabled={!!updating}
                                title="Arşivle"
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', fontSize: '11px',
                                  background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <Archive size={11} /> Arşivle
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid #F1F5F9',
              }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
                  Toplam {data.total} kayıt
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFF', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page <= 1 ? 0.4 : 1 }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#334155' }}>
                    {page} / {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFF', cursor: page < data.totalPages ? 'pointer' : 'not-allowed', opacity: page >= data.totalPages ? 0.4 : 1 }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
