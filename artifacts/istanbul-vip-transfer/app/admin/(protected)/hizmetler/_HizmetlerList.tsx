'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ServiceListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  isActive: boolean;
  displayOrder: number;
  category: string | null;
  showOnHomepage: boolean;
  showInNav: boolean;
  updatedAt: string;
  translations: Record<string, string>; // locale → status
}

interface Props { items: ServiceListItem[] }

// ── Status configs ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Taslak',  color: '#9333EA', bg: '#FAF5FF' },
  PUBLISHED: { label: 'Yayında', color: '#059669', bg: '#ECFDF5' },
  ARCHIVED:  { label: 'Arşiv',   color: '#64748B', bg: '#F1F5F9' },
};

const TX_STATUS_DOT: Record<string, string> = {
  NOT_STARTED:  '#CBD5E1',
  QUEUED:       '#F59E0B',
  TRANSLATING:  '#3B82F6',
  DRAFT:        '#A855F7',
  REVIEW:       '#A855F7',
  APPROVED:     '#06B6D4',
  PUBLISHED:    '#10B981',
  FAILED:       '#EF4444',
  ARCHIVED:     '#94A3B8',
  OUTDATED:     '#F97316',
};

const TX_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Başlamadı', QUEUED: 'Bekliyor', TRANSLATING: 'Çevriliyor',
  DRAFT: 'Taslak', REVIEW: 'İnceleniyor', APPROVED: 'Onaylandı',
  PUBLISHED: 'Yayında', FAILED: 'Hata', ARCHIVED: 'Arşiv', OUTDATED: 'Güncelleme Gerekli',
};

const CATEGORY_LABELS: Record<string, string> = {
  airport:   'Havalimanı',
  intercity: 'Şehirlerarası',
  tour:      'Tur',
  corporate: 'Kurumsal',
  health:    'Sağlık',
  vip:       'VIP',
  rental:    'Kiralama',
};

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

// ── Styles ─────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: '6px',
  fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#1E293B',
  background: '#FFFFFF', outline: 'none',
};
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

// ── Component ──────────────────────────────────────────────────────────────

export default function HizmetlerList({ items }: Props) {
  const router        = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery,     setSearchQuery]     = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('');
  const [langFilter,      setLangFilter]      = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [sortBy,          setSortBy]          = useState('displayOrder');
  const [actionLoading,   setActionLoading]   = useState<string | null>(null);
  const [confirmArchive,  setConfirmArchive]  = useState<string | null>(null);

  // ── Client-side filtering + sorting ────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        i => i.title.toLowerCase().includes(q) || i.slug.includes(q),
      );
    }
    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }
    if (statusFilter) {
      result = result.filter(i => i.status === statusFilter);
    }
    if (langFilter) {
      result = result.filter(i => {
        const txStatus = i.translations[langFilter];
        return txStatus && txStatus !== 'NOT_STARTED';
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'displayOrder') return a.displayOrder - b.displayOrder;
      if (sortBy === 'title')        return a.title.localeCompare(b.title, 'tr');
      if (sortBy === 'status')       return a.status.localeCompare(b.status);
      if (sortBy === 'updated')      return b.updatedAt.localeCompare(a.updatedAt);
      return 0;
    });

    return result;
  }, [items, searchQuery, categoryFilter, statusFilter, langFilter, sortBy]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleArchive(item: ServiceListItem) {
    if (confirmArchive !== item.id) { setConfirmArchive(item.id); return; }
    setConfirmArchive(null);
    setActionLoading(`archive-${item.id}`);
    try {
      const res = await fetch(`/admin/api/service-pages/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archiveSource' }),
      });
      if (!res.ok) throw new Error('Arşivleme başarısız.');
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDuplicate(item: ServiceListItem) {
    setActionLoading(`dup-${item.id}`);
    try {
      const res = await fetch(`/admin/api/service-pages/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const data = await res.json() as { newId?: string; error?: string };
      if (!res.ok || !data.newId) throw new Error(data.error ?? 'Kopyalama başarısız.');
      router.push(`/admin/hizmetler/${data.newId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    } finally {
      setActionLoading(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const categoryOptions = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '16px', padding: '14px 18px',
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
      }}>
        {/* Search */}
        <input
          type="search"
          placeholder="Başlık veya slug ara…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...inp, minWidth: '180px', flex: 1 }}
        />

        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={sel}>
          <option value="">Tüm kategoriler</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
          {categoryOptions.filter(c => !(c in CATEGORY_LABELS)).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Language filter */}
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)} style={sel}>
          <option value="">Tüm diller</option>
          {TARGET_LOCALES.map(lc => (
            <option key={lc} value={lc}>{lc.toUpperCase()} çeviri var</option>
          ))}
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">Tüm durumlar</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="DRAFT">Taslak</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="displayOrder">Sıraya göre</option>
          <option value="title">Başlığa göre</option>
          <option value="status">Duruma göre</option>
          <option value="updated">Güncellenme tarihine göre</option>
        </select>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 110px 160px 90px 70px 70px 120px',
          gap: '8px', padding: '10px 18px',
          background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
          fontFamily: 'Inter, sans-serif',
        }}>
          {['#', 'Başlık / Slug', 'Kategori', 'Dil Durumu', 'Durum', 'Ana Sayfa', 'Nav', 'İşlem'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
            {items.length === 0 ? 'Henüz hizmet sayfası eklenmemiş.' : 'Filtrelerle eşleşen hizmet bulunamadı.'}
          </div>
        )}

        {filtered.map((item, idx) => {
          const s     = STATUS_STYLE[item.status] ?? STATUS_STYLE.DRAFT;
          const isLoading = actionLoading?.endsWith(item.id);
          const catLabel = item.category ? (CATEGORY_LABELS[item.category] ?? item.category) : '—';

          return (
            <div key={item.id} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr 110px 160px 90px 70px 70px 120px',
              gap: '8px', padding: '12px 18px',
              borderBottom: '1px solid #F1F5F9',
              alignItems: 'center', fontFamily: 'Inter, sans-serif',
              background: !item.isActive ? '#FAFAFA' : undefined,
              opacity: isLoading ? 0.6 : 1,
            }}>
              {/* # */}
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{idx + 1}</span>

              {/* Title + slug */}
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  {item.title}
                  {!item.isActive && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(pasif)</span>
                  )}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>
                  /{item.slug.slice(0, 40)}{item.slug.length > 40 ? '…' : ''}
                </p>
              </div>

              {/* Category */}
              <span style={{ fontSize: '11px', color: '#64748B' }}>{catLabel}</span>

              {/* Language status dots */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {/* TR always shown */}
                <span title="Türkçe — Kaynak" style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 5px',
                  borderRadius: '4px', background: '#ECFDF5', color: '#059669',
                }}>
                  TR
                </span>
                {TARGET_LOCALES.map(lc => {
                  const txStatus = item.translations[lc] ?? 'NOT_STARTED';
                  const dotColor = TX_STATUS_DOT[txStatus] ?? '#CBD5E1';
                  const label    = TX_STATUS_LABEL[txStatus] ?? txStatus;
                  return (
                    <span key={lc} title={`${lc.toUpperCase()}: ${label}`} style={{
                      fontSize: '10px', fontWeight: 600, padding: '2px 5px',
                      borderRadius: '4px', background: '#F1F5F9', color: '#374151',
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                    }}>
                      {lc.toUpperCase()}
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    </span>
                  );
                })}
              </div>

              {/* Status badge */}
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                borderRadius: '12px', color: s.color, background: s.bg, textAlign: 'center',
              }}>
                {s.label}
              </span>

              {/* showOnHomepage */}
              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.showOnHomepage ? '✓' : '—'}</span>

              {/* showInNav */}
              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.showInNav ? '✓' : '—'}</span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <a
                  href={`/admin/hizmetler/${item.id}`}
                  style={{
                    fontSize: '11px', fontWeight: 600, color: '#C9A84C',
                    textDecoration: 'none', padding: '4px 8px',
                    background: '#FFFBEB', borderRadius: '5px', border: '1px solid #F59E0B',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Düzenle
                </a>
                <a
                  href={`/tr/${item.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px', fontWeight: 600, color: '#0891B2',
                    textDecoration: 'none', padding: '4px 8px',
                    background: '#ECFEFF', borderRadius: '5px', border: '1px solid #BAE6FD',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Önizle ↗
                </a>
                <button
                  onClick={() => handleDuplicate(item)}
                  disabled={!!actionLoading}
                  style={{
                    fontSize: '11px', fontWeight: 600, color: '#374151',
                    padding: '4px 8px', background: '#F1F5F9',
                    borderRadius: '5px', border: '1px solid #D1D5DB',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    opacity: actionLoading === `dup-${item.id}` ? 0.5 : 1,
                  }}
                  title="Taslak olarak kopyala"
                >
                  Kopyala
                </button>
                {item.status !== 'ARCHIVED' && (
                  <button
                    onClick={() => handleArchive(item)}
                    disabled={!!actionLoading}
                    style={{
                      fontSize: '11px', fontWeight: 600,
                      color: confirmArchive === item.id ? '#FFFFFF' : '#64748B',
                      padding: '4px 8px',
                      background: confirmArchive === item.id ? '#DC2626' : '#F8FAFC',
                      borderRadius: '5px',
                      border: `1px solid ${confirmArchive === item.id ? '#DC2626' : '#D1D5DB'}`,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      opacity: actionLoading === `archive-${item.id}` ? 0.5 : 1,
                    }}
                    title={confirmArchive === item.id ? 'Emin misiniz? Tekrar tıklayın.' : 'Arşivle'}
                  >
                    {confirmArchive === item.id ? 'Emin misiniz?' : 'Arşivle'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p style={{ marginTop: '12px', fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
        {filtered.length} / {items.length} hizmet gösteriliyor
        {isPending && ' · Yenileniyor…'}
      </p>
    </div>
  );
}
