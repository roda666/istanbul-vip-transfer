'use client';

import { useState } from 'react';
import { Globe, Loader2, Archive, Brain, AlertTriangle } from 'lucide-react';
import type { Language } from '@/db/schema';
import type { EntitySources } from './page';

/* ── Status config ─────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NOT_STARTED: { label: 'Başlanmadı',   bg: '#F8FAFC', text: '#6B7A8A', border: '#D9E2EC' },
  QUEUED:      { label: 'Sırada',       bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  TRANSLATING: { label: 'Çevriliyor',  bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  DRAFT:       { label: 'Taslak',       bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  REVIEW:      { label: 'İncelemede',  bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  APPROVED:    { label: 'Onaylı',       bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  SCHEDULED:   { label: 'Planlandı',   bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  PUBLISHED:   { label: 'Yayında',     bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  FAILED:      { label: 'Başarısız',   bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  OUTDATED:    { label: 'Güncel Değil', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  ARCHIVED:    { label: 'Arşivlendi',  bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
};

/* ── Entity type configuration ─────────────────────────────────────────── */
type ToolbarEntityType = 'content' | 'blog' | 'service_page' | 'faq' | 'vehicle' | 'navigation';

const ENTITY_TYPE_LABELS: Record<ToolbarEntityType, string> = {
  content:      'Sayfa (Statik)',
  blog:         'Blog Yazısı',
  service_page: 'Hizmet Sayfası',
  faq:          'SSS',
  vehicle:      'Araç',
  navigation:   'Navigasyon',
};

/** Maps UI entity type to the entityType string sent to the AI API. */
function getApiEntityType(toolbarType: ToolbarEntityType): string {
  // 'blog' posts are stored as entityType='content' in content_translations
  return toolbarType === 'blog' ? 'content' : toolbarType;
}

/* ── Filter tab config ──────────────────────────────────────────────────── */
const FILTER_TABS = [
  { value: '',             label: 'Tümü' },
  { value: 'page',         label: 'Sayfa' },
  { value: 'blog',         label: 'Blog' },
  { value: 'service_page', label: 'Hizmet' },
  { value: 'faq',          label: 'SSS' },
  { value: 'vehicle',      label: 'Araç' },
  { value: 'navigation',   label: 'Navigasyon' },
] as const;

type Job = {
  id: string;
  entityType: string;
  entityId: string;
  targetLanguageCode: string;
  status: string;
  title: string | null;
  isAiGenerated: boolean;
  updatedAt: Date;
  approvedAt: Date | null;
  publishedAt: Date | null;
  sourceTitle: string;
  sourceSlug: string;
  sourceStatus: string;
};

interface Props {
  jobs: Job[];
  langs: Language[];
  entitySources: EntitySources;
  page: number;
  total: number;
  limit: number;
  /** Current URL filter value ('page' | 'blog' | 'service_page' | 'faq' | 'vehicle' | 'navigation' | '') */
  entityTypeFilter: string;
}

/* ── Responsive CSS injected once ─────────────────────────────────────── */
const STYLE = `
  .ct-table-wrap { display: block; }
  .ct-cards      { display: none;  }
  @media (max-width: 767px) {
    .ct-table-wrap { display: none !important; }
    .ct-cards      { display: flex !important; flex-direction: column; gap: 10px; }
  }
  .ct-card {
    background: #FFFFFF;
    border: 1px solid #E8EDF3;
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 1px 4px rgba(16,42,67,0.05);
  }
  .ct-card-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    margin-bottom: 10px;
  }
  .ct-card-title {
    font-size: 14px; font-weight: 600; color: #1A2B3C;
    font-family: Inter, sans-serif; line-height: 1.3;
  }
  .ct-card-meta {
    font-size: 11px; color: #8899AA; margin-top: 2px; font-family: Inter, sans-serif;
  }
  .ct-card-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; margin-bottom: 8px;
  }
  .ct-card-label {
    font-size: 11px; color: #60758A; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em;
    font-family: Inter, sans-serif; flex-shrink: 0;
  }
  .ct-card-actions {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;
    border-top: 1px solid #F1F5F9; padding-top: 10px;
  }
  .ct-action-btn {
    flex: 1; min-width: 80px;
    min-height: 44px;
    display: flex; align-items: center; justify-content: center; gap: 4px;
    border-radius: 8px; font-size: 12px; font-weight: 600;
    font-family: Inter, sans-serif; cursor: pointer;
    border: 1px solid; padding: 8px 10px;
  }
  /* Desktop action buttons keep their compact size */
  .ct-tbl-btn {
    padding: 4px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 600; font-family: Inter, sans-serif;
    display: flex; align-items: center; gap: 3px; cursor: pointer;
  }
  /* Filter tabs scroll on mobile */
  .ct-filter-tabs {
    display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto;
    padding-bottom: 4px; margin-bottom: 12px;
    scrollbar-width: none;
  }
  .ct-filter-tabs::-webkit-scrollbar { display: none; }
`;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {status === 'OUTDATED'    && <AlertTriangle size={10} />}
      {status === 'TRANSLATING' && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
      {cfg.label}
    </span>
  );
}

/** Human-readable label for entityType stored in the DB. */
function EntityTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    content:      'İçerik',
    service_page: 'Hizmet',
    faq:          'SSS',
    vehicle:      'Araç',
    navigation:   'Nav',
  };
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
      background: '#F3F6FA', color: '#50677A', border: '1px solid #DDE5EF',
      fontFamily: 'Inter, sans-serif',
    }}>
      {labels[type] ?? type}
    </span>
  );
}

export default function CevirilerClient({
  jobs: initialJobs,
  langs,
  entitySources,
  page,
  total,
  limit,
  entityTypeFilter,
}: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Toolbar state ────────────────────────────────────────────────────────
  const [toolbarEntityType, setToolbarEntityType] = useState<ToolbarEntityType>('content');

  // Resolve sources for the currently selected toolbar entity type
  const currentSources = entitySources[toolbarEntityType] ?? [];
  const [sourceId, setSourceId] = useState(() => entitySources.content[0]?.id ?? '');

  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ codes: string[]; pendingLangs: string[] } | null>(null);

  const translatableLangs = langs.filter((l) => l.code !== 'tr' && l.providerSupported);
  const enabledLangCodes = translatableLangs.filter((l) => l.isEnabled).map((l) => l.code);

  function handleToolbarEntityTypeChange(type: ToolbarEntityType) {
    setToolbarEntityType(type);
    const srcs = entitySources[type] ?? [];
    setSourceId(srcs[0]?.id ?? '');
    setBulkMsg(null);
  }

  function toggleLang(code: string) {
    setSelectedLangs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function runBulkTranslate(codes: string[], force = false) {
    if (!sourceId) { setBulkMsg('Önce bir içerik seçin.'); return; }
    if (codes.length === 0) { setBulkMsg('En az bir dil seçin.'); return; }
    setBulkBusy(true);
    setBulkMsg(null);
    setError(null);
    try {
      const apiEntityType = getApiEntityType(toolbarEntityType);
      const res = await fetch('/admin/api/translations/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: apiEntityType, entityId: sourceId, targetLanguageCodes: codes, force }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        results?: Array<{ lang: string; status: string; error?: string }>;
        needsConfirmation?: string[];
      };
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? 'Çeviri isteği başarısız');

      const results = data.results ?? [];
      const ok = results.filter((r) => r.status === 'draft').map((r) => r.lang);
      const failed = results.filter((r) => ['error', 'failed'].includes(r.status));
      const needs = data.needsConfirmation ?? [];

      const parts: string[] = [];
      if (ok.length) parts.push(`Taslak oluşturuldu: ${ok.join(', ')}`);
      if (failed.length) parts.push(`Başarısız: ${failed.map((f) => `${f.lang} (${f.error ?? 'hata'})`).join(', ')}`);
      setBulkMsg(parts.join(' · ') || null);

      if (needs.length > 0) {
        setOverwriteConfirm({ codes: needs, pendingLangs: needs });
      } else if (ok.length > 0) {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function doAction(jobId: string, action: string) {
    setLoading(jobId);
    setError(null);
    try {
      const res = await fetch(`/admin/api/translations/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'İşlem başarısız');
      }
      const data = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...(data as { item: Job }).item } : j)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  // ── Filter tabs (URL-based) ──────────────────────────────────────────────
  const filterTabs = (
    <div className="ct-filter-tabs">
      {FILTER_TABS.map((tab) => {
        const isActive = entityTypeFilter === tab.value;
        const href = tab.value ? `/admin/ceviriler?entityType=${tab.value}` : '/admin/ceviriler';
        return (
          <a
            key={tab.value}
            href={href}
            style={{
              padding: '5px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', textDecoration: 'none',
              background: isActive ? '#1A2B3C' : '#FFFFFF',
              color: isActive ? '#FFFFFF' : '#50677A',
              border: `1px solid ${isActive ? '#1A2B3C' : '#D9E2EC'}`,
              flexShrink: 0,
            }}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );

  // ── Bulk AI-translate toolbar ────────────────────────────────────────────
  const bulkToolbar = (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8EDF3', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontFamily: 'Inter, sans-serif', boxShadow: '0 1px 4px rgba(16,42,67,0.05)' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A2B3C', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Brain size={14} style={{ color: '#7C3AED' }} />
        AI Çeviri Üret
      </div>

      {/* Entity type selector */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#60758A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          İçerik Türü
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(Object.keys(ENTITY_TYPE_LABELS) as ToolbarEntityType[]).map((type) => {
            const srcs = entitySources[type] ?? [];
            const active = toolbarEntityType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={bulkBusy}
                onClick={() => handleToolbarEntityTypeChange(type)}
                title={`${srcs.length} kayıt`}
                style={{
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  background: active ? '#1A2B3C' : '#FFF',
                  color: active ? '#FFF' : '#263F55',
                  border: `1px solid ${active ? '#1A2B3C' : '#D9E2EC'}`,
                  opacity: bulkBusy ? 0.6 : 1,
                }}
              >
                {ENTITY_TYPE_LABELS[type]}
                {srcs.length > 0 && (
                  <span style={{ marginLeft: '4px', opacity: 0.6, fontSize: '10px' }}>({srcs.length})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source entity selector */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#60758A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          Kaynak
        </div>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          disabled={bulkBusy}
          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #D9E2EC', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFF', color: '#1A2B3C', maxWidth: '100%', minWidth: '240px' }}
        >
          {currentSources.length === 0 && (
            <option value="">{ENTITY_TYPE_LABELS[toolbarEntityType]} kaydı bulunamadı</option>
          )}
          {currentSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}{s.slug ? ` (${s.slug})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Language selector */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#60758A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          Hedef Diller
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {translatableLangs.map((l) => {
            const active = selectedLangs.includes(l.code);
            return (
              <button key={l.code} type="button" disabled={bulkBusy} onClick={() => toggleLang(l.code)}
                title={`${l.turkishName ?? l.name}${l.isEnabled ? '' : ' (pasif — taslak hazırlanır, kamuya açılmaz)'}`}
                style={{
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  background: active ? '#1A2B3C' : '#FFF',
                  color: active ? '#FFF' : l.isEnabled ? '#263F55' : '#8899AA',
                  border: `1px solid ${active ? '#1A2B3C' : '#D9E2EC'}`,
                }}>
                {l.code}{!l.isEnabled && ' ·pasif'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={bulkBusy || selectedLangs.length === 0 || currentSources.length === 0} onClick={() => runBulkTranslate(selectedLangs)}
          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFF', fontSize: '12px', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: bulkBusy || selectedLangs.length === 0 || currentSources.length === 0 ? 0.6 : 1 }}>
          {bulkBusy ? 'Çevriliyor…' : `Seçili Dillere Çevir (${selectedLangs.length})`}
        </button>
        <button type="button" disabled={bulkBusy || enabledLangCodes.length === 0 || currentSources.length === 0} onClick={() => runBulkTranslate(enabledLangCodes)}
          style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #2563EB', background: '#EFF6FF', color: '#1D4ED8', fontSize: '12px', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: bulkBusy || currentSources.length === 0 ? 0.6 : 1 }}>
          Tüm Etkin Dillere Çevir ({enabledLangCodes.length})
        </button>
        {bulkBusy && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#2563EB' }} />}
      </div>
      {bulkMsg && (
        <p style={{ fontSize: '12px', color: '#50677A', marginTop: '10px', marginBottom: 0 }}>{bulkMsg}</p>
      )}
      <p style={{ fontSize: '11px', color: '#8899AA', marginTop: '8px', marginBottom: 0 }}>
        AI çevirileri her zaman TASLAK olarak kaydedilir — inceleme ve yayın adımları adminde kalır. Pasif dillerin taslakları kamuya görünmez.
      </p>
    </div>
  );

  const overwriteDialog = overwriteConfirm && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'Inter, sans-serif' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2B3C', marginBottom: '10px' }}>Elle Düzenlenmiş Çeviriler</h3>
        <p style={{ fontSize: '13px', color: '#50677A', lineHeight: 1.6, marginBottom: '20px' }}>
          Şu dillerde elle düzenlenmiş/kilitli çeviriler var: <strong>{overwriteConfirm.codes.join(', ')}</strong>.
          AI çevirisiyle üzerine yazılsın mı? Bu işlem mevcut düzenlemeleri değiştirir.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setOverwriteConfirm(null)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D9E2EC', background: '#FFF', cursor: 'pointer', fontSize: '13px' }}>
            Hayır, Koru
          </button>
          <button onClick={() => { const codes = overwriteConfirm.codes; setOverwriteConfirm(null); void runBulkTranslate(codes, true); }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFF', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Evet, Üzerine Yaz
          </button>
        </div>
      </div>
    </div>
  );

  const emptyState = (
    <div className="rounded-2xl p-12 text-center"
      style={{ background: '#FFFFFF', border: '1px solid #E8EDF3' }}>
      <Globe size={32} style={{ color: '#C99A32', margin: '0 auto 12px' }} />
      <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
        Bu filtre için çeviri işi bulunamadı.
      </p>
    </div>
  );

  if (jobs.length === 0) {
    return (
      <div>
        <style>{STYLE}</style>
        {filterTabs}
        {bulkToolbar}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px' }}>
            {error}
          </div>
        )}
        {emptyState}
        {overwriteDialog}
      </div>
    );
  }

  return (
    <div>
      <style>{STYLE}</style>

      {filterTabs}
      {bulkToolbar}
      {overwriteDialog}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {/* ── Desktop table ────────────────────────────────────────────── */}
      <div className="ct-table-wrap rounded-xl overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDF3' }}>
              {['İçerik', 'Tür', 'Dil', 'Durum', 'Kaynak', 'Güncelleme', 'İşlemler'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60758A', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => {
              const isLast    = i === jobs.length - 1;
              const isLoading = loading === job.id;
              return (
                <tr key={job.id} style={{ borderBottom: isLast ? 'none' : '1px solid #F1F4F8', background: isLoading ? '#FAFBFC' : '#FFFFFF', opacity: isLoading ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#1A2B3C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title ?? job.sourceTitle}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8899AA', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.sourceSlug || job.entityId.slice(0, 8)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <EntityTypeLabel type={job.entityType} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {job.isAiGenerated && <span title="AI tarafından çevrildi"><Brain size={12} style={{ color: '#7C3AED', flexShrink: 0 }} /></span>}
                      <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                        {job.targetLanguageCode}
                      </code>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', color: '#50677A' }}>{job.sourceStatus}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', color: '#8899AA' }}>
                      {new Date(job.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <TableActions job={job} isLoading={isLoading} onAction={doAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ─────────────────────────────────────────────── */}
      <div className="ct-cards">
        {jobs.map((job) => {
          const isLoading = loading === job.id;
          return (
            <div key={job.id} className="ct-card" style={{ opacity: isLoading ? 0.6 : 1 }}>
              <div className="ct-card-header">
                <div style={{ minWidth: 0 }}>
                  <div className="ct-card-title">{job.title ?? job.sourceTitle}</div>
                  <div className="ct-card-meta">
                    <EntityTypeLabel type={job.entityType} />
                    {' '}
                    {job.sourceSlug || job.entityId.slice(0, 8)}
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Dil</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {job.isAiGenerated && <Brain size={12} style={{ color: '#7C3AED' }} />}
                  <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                    {job.targetLanguageCode}
                  </code>
                </div>
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Kaynak</span>
                <span style={{ fontSize: '12px', color: '#50677A' }}>{job.sourceStatus}</span>
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Güncelleme</span>
                <span style={{ fontSize: '12px', color: '#8899AA' }}>
                  {new Date(job.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>

              <div className="ct-card-actions">
                {job.status === 'DRAFT' && (
                  <button className="ct-action-btn"
                    style={{ background: '#FFF7ED', color: '#C2410C', borderColor: '#FDBA74' }}
                    onClick={() => doAction(job.id, 'submit_review')} disabled={isLoading}>
                    📤 İncelemeye Gönder
                  </button>
                )}
                {job.status === 'REVIEW' && (
                  <button className="ct-action-btn"
                    style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                    onClick={() => doAction(job.id, 'approve')} disabled={isLoading}>
                    ✓ Onayla
                  </button>
                )}
                {job.status === 'APPROVED' && (
                  <button className="ct-action-btn"
                    style={{ background: '#F0FDF4', color: '#166534', borderColor: '#86EFAC' }}
                    onClick={() => doAction(job.id, 'publish')} disabled={isLoading}>
                    🚀 Yayınla
                  </button>
                )}
                {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
                  <button className="ct-action-btn"
                    style={{ background: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1', flex: 0 }}
                    onClick={() => doAction(job.id, 'archive')} disabled={isLoading}>
                    <Archive size={13} /> Arşiv
                  </button>
                )}
                {isLoading && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> İşleniyor…
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex justify-between items-center text-sm" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', marginTop: '16px' }}>
          <span>{total} kayıt</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {page > 1 && (
              <a href={`/admin/ceviriler?page=${page - 1}${entityTypeFilter ? `&entityType=${entityTypeFilter}` : ''}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                ← Önceki
              </a>
            )}
            {page * limit < total && (
              <a href={`/admin/ceviriler?page=${page + 1}${entityTypeFilter ? `&entityType=${entityTypeFilter}` : ''}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                Sonraki →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Desktop table action buttons ──────────────────────────────────────── */
function TableActions({ job, isLoading, onAction }: { job: Job; isLoading: boolean; onAction: (id: string, action: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {job.status === 'DRAFT' && (
        <TblBtn label="İncelemeye Gönder" color="#C2410C" bg="#FFF7ED" border="#FDBA74"
          onClick={() => onAction(job.id, 'submit_review')} disabled={isLoading} />
      )}
      {job.status === 'REVIEW' && (
        <TblBtn label="Onayla" color="#065F46" bg="#ECFDF5" border="#A7F3D0"
          onClick={() => onAction(job.id, 'approve')} disabled={isLoading} />
      )}
      {job.status === 'APPROVED' && (
        <TblBtn label="Yayınla" color="#166534" bg="#F0FDF4" border="#86EFAC"
          onClick={() => onAction(job.id, 'publish')} disabled={isLoading} />
      )}
      {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
        <TblBtn label="Arşiv" color="#64748B" bg="#F1F5F9" border="#CBD5E1"
          onClick={() => onAction(job.id, 'archive')} disabled={isLoading} icon={<Archive size={10} />} />
      )}
    </div>
  );
}

function TblBtn({ label, color, bg, border, onClick, disabled, icon }: {
  label: string; color: string; bg: string; border: string;
  onClick: () => void; disabled: boolean; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="ct-tbl-btn"
      style={{ background: bg, color, border: `1px solid ${border}`, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {icon}{label}
    </button>
  );
}
