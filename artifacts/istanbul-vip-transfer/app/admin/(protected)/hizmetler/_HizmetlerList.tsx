'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Copy, Eye, Plus } from 'lucide-react';
import { AdminRecordActions } from '@/app/admin/_components/AdminRecordActions';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';
import { AdminCmsLanguageBadges } from '@/app/admin/_components/AdminCmsLanguageBadges';

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
  hasReachableHeroImage: boolean;
  updatedAt: string;
  translations: Record<string, string>; // locale → status
  /** Live "starting from" EUR price computed from panel pricing data. null = no price data defined yet. */
  startingPriceEur: number | null;
  /**
   * True for synthetic rows representing a Service slug registered in
   * PAGE_REGISTRY that has zero CMS records — not even a draft. These rows
   * have no real database id, so normal edit/preview/duplicate/archive
   * actions do not apply; only a "create content" shortcut is shown.
   */
  missingRecord?: boolean;
}

interface Props { items: ServiceListItem[] }

// ── Status configs ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Taslak',  color: '#9333EA', bg: '#FAF5FF' },
  PUBLISHED: { label: 'Yayında', color: '#059669', bg: '#ECFDF5' },
  ARCHIVED:  { label: 'Arşiv',   color: '#64748B', bg: '#F1F5F9' },
  MISSING:   { label: '⚠ Kayıt Yok', color: '#B42318', bg: '#FEF3F2' },
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
  return <AdminCmsLanguageBadges statuses={{ tr: 'PUBLISHED', ...translations }} />;
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

function MissingHeroBadge() {
  return (
    <span title="Kapak görseli yok veya kayıtlı görsel artık erişilebilir değil" style={{
      display: 'block', marginTop: '3px', fontSize: '10px', fontWeight: 700,
      color: '#B42318', background: '#FEF3F2', border: '1px solid #FDA29B',
      borderRadius: '8px', padding: '1px 6px', width: 'fit-content',
    }}>
      ⚠ Kapak görseli eksik
    </span>
  );
}

function ActionButtons({
  item,
  actionLoading,
  onDuplicate,
  onArchive,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  item: ServiceListItem;
  actionLoading: string | null;
  onDuplicate: (item: ServiceListItem) => void;
  onArchive:   (item: ServiceListItem) => void;
  onDelete: (item: ServiceListItem) => void;
  onMove: (item: ServiceListItem, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const isLoading = actionLoading?.endsWith(item.id);

  if (item.missingRecord) {
    return (
      <AdminActionButton
        href={`/admin/hizmetler/yeni?slug=${encodeURIComponent(item.slug)}&title=${encodeURIComponent(item.title)}`}
        label="İçerik Oluştur"
        icon={Plus}
        variant="new"
        manage={false}
        className="text-xs"
      />
    );
  }

  return (
    <AdminRecordActions
      up={{ onClick: () => onMove(item, 'up'), disabled: !canMoveUp || !!actionLoading }}
      down={{ onClick: () => onMove(item, 'down'), disabled: !canMoveDown || !!actionLoading }}
      edit={{ href: `/admin/hizmetler/${item.id}` }}
      archive={item.status !== 'ARCHIVED' ? {
        onClick: () => onArchive(item),
        disabled: !!actionLoading || !!isLoading,
        isArchived: false
      } : undefined}
      delete={['DRAFT', 'ARCHIVED', 'IDEA', 'RESEARCH'].includes(item.status) ? {
        onClick: () => onDelete(item),
        disabled: !!actionLoading || !!isLoading,
        confirmMessage: `"${item.title}" hizmetini silmek istediğinizden emin misiniz? Bu işlem yalnızca bağlı olmayan taslak içeriği ve kendi çevirilerini kaldırır.`,
      } : undefined}
      deleteOmittedReason={!['DRAFT', 'ARCHIVED', 'IDEA', 'RESEARCH'].includes(item.status) ? 'Yayındaki hizmeti silmek için önce arşivleyin.' : undefined}
      customActions={[
        {
          id: 'duplicate',
          label: 'Kopyala',
          icon: Copy,
          colorClass: 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100',
          onClick: () => onDuplicate(item),
          disabled: !!actionLoading || !!isLoading
        },
        {
          id: 'preview',
          label: 'Önizle ↗',
          icon: Eye,
          colorClass: 'text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100',
          mobileColorClass: 'text-cyan-700 hover:bg-cyan-50',
          onClick: () => { window.open(`/tr/${item.slug}`, '_blank'); }
        }
      ]}
    />
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
    if (!window.confirm(`"${item.title}" hizmetini arşivlemek istediğinize emin misiniz?`)) return;
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

  async function handleDelete(item: ServiceListItem) {
    if (actionLoading) return;
    setActionLoading(`delete-${item.id}`);
    try {
      const res = await fetch(`/admin/api/service-pages/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({})) as { error?: string; dependencies?: Array<{ label: string; count: number }> };
      if (!res.ok) {
        const details = data.dependencies?.map(dep => `${dep.label}: ${dep.count}`).join(', ');
        throw new Error(details ? `${data.error ?? 'Silme engellendi.'} (${details})` : (data.error ?? 'Silme başarısız.'));
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Silme başarısız.');
    } finally {
      setActionLoading(null);
    }
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

  async function handleMove(item: ServiceListItem, direction: 'up' | 'down') {
    const index = filtered.findIndex(i => i.id === item.id);
    if (!filtered[index + (direction === 'up' ? -1 : 1)]) return;
    const res = await fetch(`/admin/api/service-pages/${item.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction }),
    });
    if (res.ok) router.refresh(); else alert('Sıralama güncellenemedi.');
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
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            text-align: center;
            min-width: 72px;
          }

          /* Toolbar wraps well on mobile already, but ensure min sizing */
          .hl-toolbar input, .hl-toolbar select {
            min-height: 44px !important;
            min-width: 0 !important;
            flex: 1 1 140px !important;
          }
        }

        /* Desktop toolbar inputs/selects */
        .hl-toolbar input, .hl-toolbar select {
          min-height: 44px;
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
          <option value="MISSING">⚠ Kayıt Yok</option>
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
          gridTemplateColumns: '36px 52px minmax(150px,1fr) 110px minmax(170px,1fr) 90px 60px 50px minmax(380px,auto)',
          gap: '8px', padding: '10px 18px',
          background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
          fontFamily: 'Inter, sans-serif',
          minWidth: '1120px',
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
            <div data-testid="service-row" data-service-id={item.id} key={item.id} className="hl-table-row" style={{
              gridTemplateColumns: '36px 52px minmax(150px,1fr) 110px minmax(170px,1fr) 90px 60px 50px minmax(380px,auto)',
              gap: '8px', padding: '12px 18px',
              borderBottom: '1px solid #F1F5F9', alignItems: 'center',
              fontFamily: 'Inter, sans-serif',
              background: item.missingRecord ? '#FFFBFA' : (!item.isActive ? '#FAFAFA' : undefined),
              opacity: actionLoading?.endsWith(item.id) ? 0.6 : 1,
               minWidth: '1120px',
            }}
              title={item.missingRecord ? `"${item.slug}" PAGE_REGISTRY'de kayıtlı ama veritabanında hiç kaydı yok (taslak dahi yok). Ziyaretçiler bu sayfada boş/noindex içerik görür.` : undefined}
            >
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{idx + 1}</span>
              <CoverThumbnail src={item.hasReachableHeroImage ? item.heroImage : null} title={item.title} />

              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  {item.title}
                  {!item.isActive && !item.missingRecord && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(pasif)</span>}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>
                  /{item.slug.slice(0, 40)}{item.slug.length > 40 ? '…' : ''}
                </p>
              </div>

              {item.missingRecord ? (
                <span style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                  PAGE_REGISTRY&apos;de var, DB kaydı yok
                </span>
              ) : (
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
                   {!item.hasReachableHeroImage && <MissingHeroBadge />}
                </span>
              )}

              {item.missingRecord ? <span /> : <LangDots translations={item.translations} />}

              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                borderRadius: '12px', color: s.color, background: s.bg, textAlign: 'center',
              }}>{s.label}</span>

              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.missingRecord ? '—' : (item.showOnHomepage ? '✓' : '—')}</span>
              <span style={{ fontSize: '13px', textAlign: 'center' }}>{item.missingRecord ? '—' : (item.showInNav ? '✓' : '—')}</span>

              <ActionButtons
                item={item}
                actionLoading={actionLoading}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onMove={handleMove}
                canMoveUp={idx > 0}
                canMoveDown={idx < filtered.length - 1}
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
            <div data-testid="service-row" data-service-id={item.id} key={item.id} className="hl-card"
              style={{
                opacity: actionLoading?.endsWith(item.id) ? 0.6 : 1,
                ...(item.missingRecord ? { background: '#FFFBFA', borderColor: '#FDA29B' } : {}),
              }}
            >
              {/* Title row */}
              <div className="hl-card-top">
                <CoverThumbnail src={item.hasReachableHeroImage ? item.heroImage : null} title={item.title} />
                <p className="hl-card-title">
                  <span style={{ color: '#94A3B8', fontWeight: 400, marginRight: '6px' }}>{idx + 1}.</span>
                  {item.title}
                  {!item.isActive && !item.missingRecord && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>(pasif)</span>}
                </p>
                <span style={{
                  flexShrink: 0,
                  fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                  borderRadius: '12px', color: s.color, background: s.bg,
                }}>{s.label}</span>
              </div>

              {/* Slug */}
              <p className="hl-card-slug">/{item.slug}</p>

              {item.missingRecord ? (
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                  PAGE_REGISTRY&apos;de kayıtlı ama veritabanında hiç kaydı yok (taslak dahi yok).
                </p>
              ) : (
                <>
                  {/* Meta row */}
                  <div className="hl-card-meta">
                    {catLabel && <span style={{ background: '#F1F5F9', borderRadius: '4px', padding: '1px 6px' }}>{catLabel}</span>}
                    {item.startingPriceEur === null && (
                      <span title="Bu hizmet için tanımlı fiyat verisi yok" style={{
                        background: '#FFF7ED', color: '#B45309', border: '1px solid #FBBF24',
                        borderRadius: '4px', padding: '1px 6px', fontWeight: 700,
                      }}>⚠ Fiyat verisi eksik</span>
                    )}
                    {!item.hasReachableHeroImage && <MissingHeroBadge />}
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
                </>
              )}

              {/* Actions */}
              <div className="hl-card-actions">
                <ActionButtons
                  item={item}
                  actionLoading={actionLoading}
                  onDuplicate={handleDuplicate}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onMove={handleMove}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < filtered.length - 1}
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
