'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
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
  heroImage: string | null;
  updatedAt: string;
  translations: Record<string, string>; // locale → status
  /** Live "starting from" EUR price computed from panel pricing data. null = no price data defined yet. */
  startingPriceEur: number | null;
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

// CATEGORY_LABELS is now fetched dynamically from /admin/api/categories

const TARGET_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

// ── Base styles ─────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: '6px',
  fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#1E293B',
  background: '#FFFFFF', outline: 'none',
};
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

// ── Sub-components ─────────────────────────────────────────────────────────

function LangDots({ translations }: { translations: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      <span title="Türkçe — Kaynak" style={{
        fontSize: '10px', fontWeight: 600, padding: '2px 5px',
        borderRadius: '4px', background: '#ECFDF5', color: '#059669',
      }}>TR</span>
      {TARGET_LOCALES.map(lc => {
        const txStatus = translations[lc] ?? 'NOT_STARTED';
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
  );
}

function CoverThumbnail({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span title={src ? 'Kapak görseli yüklenemedi' : 'Kapak görseli yok'} style={{
        width: '42px', height: '32px', borderRadius: '5px', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#F1F5F9', border: '1px dashed #CBD5E1', color: '#94A3B8',
        fontSize: '9px', fontWeight: 600,
      }}>Yok</span>
    );
  }
  return (
    <Image
      src={src}
      alt={`${title} kapak görseli`}
      width={42}
      height={32}
      onError={() => setFailed(true)}
      style={{ width: '42px', height: '32px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }}
    />
  );
}

function ActionButtons({
  item,
  confirmArchive,
  actionLoading,
  onDuplicate,
  onArchive,
}: {
  item: ServiceListItem;
  confirmArchive: string | null;
  actionLoading: string | null;
  onDuplicate: (item: ServiceListItem) => void;
  onArchive:   (item: ServiceListItem) => void;
}) {
  const isLoading = actionLoading?.endsWith(item.id);
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      <a href={`/admin/hizmetler/${item.id}`} style={{
        fontSize: '11px', fontWeight: 600, color: '#C9A84C',
        textDecoration: 'none', padding: '4px 8px',
        background: '#FFFBEB', borderRadius: '5px', border: '1px solid #F59E0B',
        whiteSpace: 'nowrap',
      }}>Düzenle</a>
      <a href={`/tr/${item.slug}`} target="_blank" rel="noopener noreferrer" style={{
        fontSize: '11px', fontWeight: 600, color: '#0891B2',
        textDecoration: 'none', padding: '4px 8px',
        background: '#ECFEFF', borderRadius: '5px', border: '1px solid #BAE6FD',
        whiteSpace: 'nowrap',
      }}>Önizle ↗</a>
      <button onClick={() => onDuplicate(item)} disabled={!!actionLoading || !!isLoading}
        style={{
          fontSize: '11px', fontWeight: 600, color: '#374151', padding: '4px 8px',
          background: '#F1F5F9', borderRadius: '5px', border: '1px solid #D1D5DB',
          cursor: 'pointer', whiteSpace: 'nowrap',
          opacity: actionLoading === `dup-${item.id}` ? 0.5 : 1,
        }}
        title="Taslak olarak kopyala"
      >Kopyala</button>
      {item.status !== 'ARCHIVED' && (
        <button onClick={() => onArchive(item)} disabled={!!actionLoading || !!isLoading}
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
        >{confirmArchive === item.id ? 'Emin misiniz?' : 'Arşivle'}</button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

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

  // ── Dynamic category map from DB ────────────────────────────────────────
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/admin/api/categories')
      .then(r => r.json())
      .then((d: { categories?: { slug: string; nameTranslations: Record<string,string> }[] }) => {
        if (d.categories) {
          const m: Record<string,string> = {};
          for (const c of d.categories) m[c.slug] = c.nameTranslations?.['tr'] ?? c.slug;
          setCatMap(m);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.slug.includes(q));
    }
    if (categoryFilter) result = result.filter(i => i.category === categoryFilter);
    if (statusFilter)   result = result.filter(i => i.status === statusFilter);
    if (langFilter) {
      result = result.filter(i => {
        const tx = i.translations[langFilter];
        return tx && tx !== 'NOT_STARTED';
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

  async function handleArchive(item: ServiceListItem) {
    if (confirmArchive !== item.id) { setConfirmArchive(item.id); return; }
    setConfirmArchive(null);
    setActionLoading(`archive-${item.id}`);
    try {
      const res = await fetch(`/admin/api/service-pages/${item.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archiveSource' }),
      });
      if (!res.ok) throw new Error('Arşivleme başarısız.');
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    } finally { setActionLoading(null); }
  }

  async function handleDuplicate(item: ServiceListItem) {
    setActionLoading(`dup-${item.id}`);
    try {
      const res = await fetch(`/admin/api/service-pages/${item.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const data = await res.json() as { newId?: string; error?: string };
      if (!res.ok || !data.newId) throw new Error(data.error ?? 'Kopyalama başarısız.');
      router.push(`/admin/hizmetler/${data.newId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Hata oluştu.');
    } finally { setActionLoading(null); }
  }

  const categoryOptions = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  return (
    <div>
      {/* ── Responsive styles ──────────────────────────────────────────── */}
      <style>{`
        /* Scrollable table wrapper — always present but only needed on narrow viewports */
        .hl-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        /* Mobile card grid — hidden on desktop */
        .hl-cards { display: none; }

        /* Table header + rows — visible on desktop */
        .hl-table-header { display: grid; }
        .hl-table-row    { display: grid; }

        @media (max-width: 768px) {
          /* Switch to card layout */
          .hl-table-header { display: none !important; }
          .hl-table-row    { display: none !important; }
          .hl-cards        { display: flex; flex-direction: column; gap: 10px; }

          /* Card item */
          .hl-card {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 14px 16px;
            font-family: Inter, sans-serif;
          }
          .hl-card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 4px;
          }
          .hl-card-title {
            font-size: 13px;
            font-weight: 600;
            color: #1E293B;
            margin: 0;
            flex: 1;
            min-width: 0;
            word-break: break-word;
          }
          .hl-card-slug {
            font-size: 11px;
            color: #94A3B8;
            margin: 0 0 8px 0;
            word-break: break-all;
          }
          .hl-card-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            font-size: 11px;
            color: #64748B;
          }
          .hl-card-langs {
            margin-bottom: 10px;
          }
          .hl-card-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .hl-card-actions a,
          .hl-card-actions button {
            flex: 1 1 auto;
            text-align: center;
            min-width: 72px;
          }

          /* Toolbar wraps well on mobile already, but ensure min sizing */
          .hl-toolbar input, .hl-toolbar select {
            min-width: 0 !important;
            flex: 1 1 140px !important;
          }
        }

        @media (max-width: 480px) {
          .hl-card-actions a,
          .hl-card-actions button {
            flex: 1 1 100%;
          }
        }
      `}</style>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="hl-toolbar" style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '16px', padding: '14px 18px',
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
      }}>
        <input
          type="search"
          placeholder="Başlık veya slug ara…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...inp, minWidth: '180px', flex: 1 }}
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={sel}>
          <option value="">Tüm kategoriler</option>
          {Object.entries(catMap).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
          {categoryOptions.filter(c => !(c in catMap)).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)} style={sel}>
          <option value="">Tüm diller</option>
          {TARGET_LOCALES.map(lc => (
            <option key={lc} value={lc}>{lc.toUpperCase()} çeviri var</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">Tüm durumlar</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="DRAFT">Taslak</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="displayOrder">Sıraya göre</option>
          <option value="title">Başlığa göre</option>
          <option value="status">Duruma göre</option>
          <option value="updated">Güncellenme tarihine göre</option>
        </select>
      </div>

      {/* ── Desktop table ────────────────────────────────────────────────── */}
      <div className="hl-table-wrap" style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        {/* Table header — desktop only */}
        <div className="hl-table-header" style={{
          gridTemplateColumns: '36px 52px 1fr 110px 1fr 90px 60px 50px 140px',
          gap: '8px', padding: '10px 18px',
          background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
          fontFamily: 'Inter, sans-serif',
          minWidth: '760px',
        }}>
          {['#', 'Kapak', 'Başlık / Slug', 'Kategori', 'Dil Durumu (9 dil)', 'Durum', 'Ana Sayfa', 'Menü', 'İşlem'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
            {items.length === 0 ? 'Henüz hizmet sayfası eklenmemiş.' : 'Filtrelerle eşleşen hizmet bulunamadı.'}
          </div>
        )}

        {filtered.map((item, idx) => {
          const s        = STATUS_STYLE[item.status] ?? STATUS_STYLE.DRAFT;
          const catLabel = item.category ? (catMap[item.category] ?? item.category) : '—';

          return (
            <div key={item.id} className="hl-table-row" style={{
              gridTemplateColumns: '36px 52px 1fr 110px 1fr 90px 60px 50px 140px',
              gap: '8px', padding: '12px 18px',
              borderBottom: '1px solid #F1F5F9', alignItems: 'center',
              fontFamily: 'Inter, sans-serif',
              background: !item.isActive ? '#FAFAFA' : undefined,
              opacity: actionLoading?.endsWith(item.id) ? 0.6 : 1,
              minWidth: '760px',
            }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{idx + 1}</span>
              <CoverThumbnail src={item.heroImage} title={item.title} />

              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  {item.title}
                  {!item.isActive && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(pasif)</span>}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>
                  /{item.slug.slice(0, 40)}{item.slug.length > 40 ? '…' : ''}
                </p>
              </div>

              <span style={{ fontSize: '11px', color: '#64748B' }}>
                {catLabel}
                {item.startingPriceEur === null && (
                  <span title="Bu hizmet için tanımlı fiyat verisi yok" style={{
                    display: 'block', marginTop: '3px', fontSize: '10px', fontWeight: 700,
                    color: '#B45309', background: '#FFF7ED', border: '1px solid #FBBF24',
                    borderRadius: '8px', padding: '1px 6px', width: 'fit-content',
                  }}>
                    ⚠ Fiyat verisi eksik
                  </span>
                )}
              </span>

              <LangDots translations={item.translations} />

              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                borderRadius: '12px', color: s.color, background: s.bg, textAlign: 'center',
              }}>{s.label}</span>

              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.showOnHomepage ? '✓' : '—'}</span>
              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.showInNav ? '✓' : '—'}</span>

              <ActionButtons
                item={item}
                confirmArchive={confirmArchive}
                actionLoading={actionLoading}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
              />
            </div>
          );
        })}
      </div>

      {/* ── Mobile card list ──────────────────────────────────────────────── */}
      <div className="hl-cards" style={{ marginTop: '4px' }}>
        {filtered.length === 0 && (
          <p style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>
            {items.length === 0 ? 'Henüz hizmet sayfası eklenmemiş.' : 'Filtrelerle eşleşen hizmet bulunamadı.'}
          </p>
        )}

        {filtered.map((item, idx) => {
          const s        = STATUS_STYLE[item.status] ?? STATUS_STYLE.DRAFT;
          const catLabel = item.category ? (catMap[item.category] ?? item.category) : null;

          return (
            <div key={item.id} className="hl-card"
              style={{ opacity: actionLoading?.endsWith(item.id) ? 0.6 : 1 }}
            >
              {/* Title row */}
              <div className="hl-card-top">
                <CoverThumbnail src={item.heroImage} title={item.title} />
                <p className="hl-card-title">
                  <span style={{ color: '#94A3B8', fontWeight: 400, marginRight: '6px' }}>{idx + 1}.</span>
                  {item.title}
                  {!item.isActive && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(pasif)</span>}
                </p>
                <span style={{
                  flexShrink: 0,
                  fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                  borderRadius: '12px', color: s.color, background: s.bg,
                }}>{s.label}</span>
              </div>

              {/* Slug */}
              <p className="hl-card-slug">/{item.slug}</p>

              {/* Meta row */}
              <div className="hl-card-meta">
                {catLabel && <span style={{ background: '#F1F5F9', borderRadius: '4px', padding: '1px 6px' }}>{catLabel}</span>}
                {item.startingPriceEur === null && (
                  <span title="Bu hizmet için tanımlı fiyat verisi yok" style={{
                    background: '#FFF7ED', color: '#B45309', border: '1px solid #FBBF24',
                    borderRadius: '4px', padding: '1px 6px', fontWeight: 700,
                  }}>⚠ Fiyat verisi eksik</span>
                )}
                <span style={{
                  background: item.showOnHomepage ? '#ECFDF5' : '#F1F5F9',
                  color: item.showOnHomepage ? '#059669' : '#64748B',
                  borderRadius: '4px', padding: '1px 6px',
                }}>Ana Sayfa: {item.showOnHomepage ? 'Açık' : 'Kapalı'}</span>
                <span style={{
                  background: item.showInNav ? '#EFF6FF' : '#F1F5F9',
                  color: item.showInNav ? '#2563EB' : '#64748B',
                  borderRadius: '4px', padding: '1px 6px',
                }}>Menü: {item.showInNav ? 'Açık' : 'Kapalı'}</span>
              </div>

              {/* Language status dots */}
              <div className="hl-card-langs">
                <LangDots translations={item.translations} />
              </div>

              {/* Actions */}
              <div className="hl-card-actions">
                <ActionButtons
                  item={item}
                  confirmArchive={confirmArchive}
                  actionLoading={actionLoading}
                  onDuplicate={handleDuplicate}
                  onArchive={handleArchive}
                />
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
