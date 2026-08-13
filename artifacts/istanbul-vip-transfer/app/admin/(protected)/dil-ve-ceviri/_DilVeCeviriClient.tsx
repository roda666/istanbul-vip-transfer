'use client';

/**
 * Unified Dil ve Çeviri client component.
 *
 * Five tabs:
 *  • genel-bakis      — Coverage overview per language
 *  • diller           — Language catalogue (enable / publish toggles)
 *  • ceviriler-isleri — Bulk AI-translate trigger + per-entity status
 *  • icerik-cevirileri— Filterable, paginated translation-job table
 *  • ayarlar          — AI provider info + translation settings (read-only)
 *
 * Tab is driven by the `?tab=` URL query param so old permanent redirects
 * from /admin/diller and /admin/ceviriler land on the correct tab.
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe, ChevronDown, Search, CheckCircle2, XCircle, RefreshCw,
  Loader2, Archive, BarChart3, Settings, FileText,
  AlertCircle, Sparkles, ArrowRight,
} from 'lucide-react';
import { LOCALE_FLAG_EMOJIS } from '@/lib/i18n/locale-registry';
import type {
  LangTranslationStats, CoverageStats, EntitySources, Job, DbLang,
} from './page';

/* ─────────────────────────── Types ────────────────────────────────────── */

type Lang = DbLang;

/** Convenience: flag emoji from registry (not stored in DB). */
function flag(code: string): string {
  return (LOCALE_FLAG_EMOJIS as Record<string, string>)[code] ?? '🌐';
}

type Props = {
  langs: Lang[];
  stats: LangTranslationStats;
  coverage: CoverageStats;
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  entitySources: EntitySources;
  entityTypeFilter: string;
  langFilter: string;
  initialTab: string;
};

/* ─────────────────────────── Shared styles ─────────────────────────────── */

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '10px',
  border: '1px solid #E2EAF0',
  padding: '20px',
  marginBottom: '16px',
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  fontSize: '13px',
  fontWeight: active ? 600 : 400,
  background: active ? '#3B82F6' : 'transparent',
  color: active ? '#fff' : '#60748A',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap',
});

/* ─────────────────────────── Root component ────────────────────────────── */

export default function DilVeCeviriClient({
  langs, stats, coverage, jobs, total, page, limit,
  entitySources, entityTypeFilter, langFilter, initialTab,
}: Props) {
  const router     = useRouter();
  const sp         = useSearchParams();
  const [tab, setTab] = useState<string>(initialTab);

  const changeTab = useCallback((t: string) => {
    setTab(t);
    const params = new URLSearchParams(sp.toString());
    params.set('tab', t);
    // reset pagination when switching tabs
    params.delete('page');
    router.push(`/admin/dil-ve-ceviri?${params.toString()}`);
  }, [sp, router]);

  const TABS = [
    { key: 'genel-bakis',        label: 'Genel Bakış',       icon: <BarChart3 size={14} /> },
    { key: 'diller',             label: 'Diller',             icon: <Globe size={14} /> },
    { key: 'ceviriler-isleri',   label: 'Çeviri İşleri',     icon: <Sparkles size={14} /> },
    { key: 'icerik-cevirileri',  label: 'İçerik Çevirileri', icon: <FileText size={14} /> },
    { key: 'ayarlar',            label: 'Ayarlar',            icon: <Settings size={14} /> },
  ];

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '4px', flexWrap: 'wrap',
        borderBottom: '2px solid #E2EAF0', paddingBottom: '0', marginBottom: '24px',
        overflowX: 'auto',
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{
              ...tabBtnStyle(tab === t.key),
              borderRadius: '8px 8px 0 0',
              borderBottom: tab === t.key ? '2px solid #3B82F6' : '2px solid transparent',
              marginBottom: '-2px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onClick={() => changeTab(t.key)}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'genel-bakis'       && <GelenBakisTab langs={langs} coverage={coverage} stats={stats} />}
      {tab === 'diller'            && <DillerTab langs={langs} stats={stats} />}
      {tab === 'ceviriler-isleri'  && <CevirilerIsleriTab langs={langs} entitySources={entitySources} />}
      {tab === 'icerik-cevirileri' && (
        <IcerikCevirileriTab
          jobs={jobs} total={total} page={page} limit={limit}
          entityTypeFilter={entityTypeFilter} langFilter={langFilter} langs={langs}
        />
      )}
      {tab === 'ayarlar'           && <AyarlarTab langs={langs} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 1 — Genel Bakış
   ═══════════════════════════════════════════════════════════════════════════ */

function GelenBakisTab({ langs, coverage, stats }: {
  langs: Lang[];
  coverage: CoverageStats;
  stats: LangTranslationStats;
}) {
  const nonTr = langs.filter((l) => l.code !== 'tr' && l.isEnabled);
  const total  = Object.values(coverage).reduce((s, v) => Math.max(s, v.total), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {nonTr.map((lang) => {
          const cov = coverage[lang.code] ?? { published: 0, total };
          const pct = cov.total > 0 ? Math.round((cov.published / cov.total) * 100) : 0;
          const s   = stats[lang.code];
          const pending = (s?.draft ?? 0) + (s?.review ?? 0) + (s?.approved ?? 0);
          return (
            <div key={lang.code} style={{ ...card, padding: '16px', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>{flag(lang.code)}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
                    {lang.nativeName || lang.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#60748A', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                    {lang.code}
                    {lang.isPublished ? <span style={{ marginLeft: '6px', color: '#16A34A' }}>● Yayında</span>
                      : <span style={{ marginLeft: '6px', color: '#D97706' }}>● Beklemede</span>}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: '6px', borderRadius: '3px', background: '#E2EAF0', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${pct}%`,
                  background: pct >= 80 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626',
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#60748A' }}>
                <span>{cov.published} / {cov.total} yayında</span>
                <span style={{ fontWeight: 600, color: pct >= 80 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626' }}>{pct}%</span>
              </div>
              {pending > 0 && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#3B82F6', fontFamily: 'Inter, sans-serif' }}>
                  {pending} işlem bekliyor
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggregate stats */}
      <div style={{ ...card }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 600, color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
          Özet
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Aktif Dil', value: langs.filter((l) => l.isEnabled).length, color: '#3B82F6' },
            { label: 'Yayında Dil', value: langs.filter((l) => l.isPublished).length, color: '#16A34A' },
            { label: 'Taslak', value: Object.values(stats).reduce((s, v) => s + v.draft, 0), color: '#D97706' },
            { label: 'İncelemede', value: Object.values(stats).reduce((s, v) => s + v.review, 0), color: '#7C3AED' },
            { label: 'Onaylı', value: Object.values(stats).reduce((s, v) => s + v.approved, 0), color: '#2563EB' },
            { label: 'Yayında', value: Object.values(stats).reduce((s, v) => s + v.published, 0), color: '#16A34A' },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: 'center', padding: '12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2EAF0' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: item.color, fontFamily: 'Inter, sans-serif' }}>{item.value}</div>
              <div style={{ fontSize: '11px', color: '#60748A', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 2 — Diller
   ═══════════════════════════════════════════════════════════════════════════ */

function DillerTab({ langs, stats }: { langs: Lang[]; stats: LangTranslationStats }) {
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [confirm, setConfirm] = useState<{ lang: Lang; action: 'enable' | 'disable' | 'publish' | 'unpublish' } | null>(null);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [localLangs, setLocalLangs] = useState<Lang[]>(langs);

  const filtered = localLangs.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase()) ||
      (l.nativeName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchEnabled =
      filterEnabled === 'all' ? true :
      filterEnabled === 'enabled' ? l.isEnabled :
      !l.isEnabled;
    return matchSearch && matchEnabled;
  });

  async function doAction(lang: Lang, action: 'enable' | 'disable' | 'publish' | 'unpublish') {
    setLoadingCode(lang.code);
    try {
      const payload: Record<string, boolean> =
        action === 'enable'    ? { isEnabled: true } :
        action === 'disable'   ? { isEnabled: false } :
        action === 'publish'   ? { isPublished: true } :
                                  { isPublished: false };
      const res = await fetch(`/admin/api/languages/${lang.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setLocalLangs((prev) => prev.map((l) => l.id === lang.id ? { ...l, ...data.item } : l));
    } catch (e) {
      alert('Hata: ' + String(e));
    } finally {
      setLoadingCode(null);
      setConfirm(null);
    }
  }

  return (
    <div>
      {/* Confirm dialog */}
      {confirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '360px', width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#1A2B3C' }}>
              {confirm.action === 'enable' ? 'Dili Etkinleştir' :
               confirm.action === 'disable' ? 'Dili Devre Dışı Bırak' :
               confirm.action === 'publish' ? 'Yayına Al' : 'Yayından Kaldır'}
            </h3>
            <p style={{ margin: '0 0 20px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#4B6375' }}>
              <strong>{confirm.lang.code.toUpperCase()}</strong> ({confirm.lang.nativeName || confirm.lang.name}) dili için bu işlemi onaylıyor musunuz?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirm(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D0D9E0', background: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#4B6375' }}
              >
                İptal
              </button>
              <button
                onClick={() => doAction(confirm.lang, confirm.action)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#fff',
                  background: confirm.action === 'disable' || confirm.action === 'unpublish' ? '#DC2626' : '#16A34A',
                }}
              >
                {loadingCode === confirm.lang.code ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8AA0B0' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dil ara…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px',
              borderRadius: '8px', border: '1px solid #D0D9E0', fontSize: '13px',
              fontFamily: 'Inter, sans-serif', color: '#1A2B3C', background: '#fff',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'enabled', 'disabled'] as const).map((f) => (
            <button key={f}
              onClick={() => setFilterEnabled(f)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: '1px solid #D0D9E0',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px',
                background: filterEnabled === f ? '#3B82F6' : '#fff',
                color: filterEnabled === f ? '#fff' : '#4B6375',
              }}
            >
              {f === 'all' ? 'Tümü' : f === 'enabled' ? 'Aktif' : 'Pasif'}
            </button>
          ))}
        </div>
      </div>

      {/* Language cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((lang) => {
          const s = stats[lang.code];
          const isLoading = loadingCode === lang.code;
          return (
            <div key={lang.code} style={{ ...card, marginBottom: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              {/* Flag + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 180px' }}>
                <span style={{ fontSize: '22px' }}>{flag(lang.code)}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
                    {lang.nativeName || lang.name}
                    {lang.code === 'tr' && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#60748A', fontWeight: 400 }}>(Kaynak)</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#60748A', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>{lang.code}</div>
                </div>
              </div>

              {/* Stats */}
              {s && (
                <div style={{ display: 'flex', gap: '12px', flex: '1 1 200px' }}>
                  {[
                    { label: 'Taslak', value: s.draft, color: '#D97706' },
                    { label: 'İnceleme', value: s.review, color: '#7C3AED' },
                    { label: 'Onaylı', value: s.approved, color: '#2563EB' },
                    { label: 'Yayında', value: s.published, color: '#16A34A' },
                  ].map((stat) => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: stat.color, fontFamily: 'Inter, sans-serif' }}>{stat.value}</div>
                      <div style={{ fontSize: '10px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Status badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: '1 1 120px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Inter, sans-serif',
                  background: lang.isEnabled ? '#ECFDF5' : '#F1F5F9',
                  color: lang.isEnabled ? '#065F46' : '#64748B',
                  border: `1px solid ${lang.isEnabled ? '#A7F3D0' : '#CBD5E1'}`,
                }}>
                  {lang.isEnabled ? '✓ Aktif' : '✗ Pasif'}
                </span>
                {lang.isEnabled && (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Inter, sans-serif',
                    background: lang.isPublished ? '#EFF6FF' : '#FFFBEB',
                    color: lang.isPublished ? '#1D4ED8' : '#B45309',
                    border: `1px solid ${lang.isPublished ? '#BFDBFE' : '#FDE68A'}`,
                  }}>
                    {lang.isPublished ? '● Yayında' : '○ Yayında Değil'}
                  </span>
                )}
              </div>

              {/* Actions */}
              {lang.code !== 'tr' && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {isLoading ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#3B82F6' }} />
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirm({ lang, action: lang.isEnabled ? 'disable' : 'enable' })}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #D0D9E0',
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px',
                          background: lang.isEnabled ? '#FFF1F2' : '#F0FDF4',
                          color: lang.isEnabled ? '#BE123C' : '#15803D',
                        }}
                      >
                        {lang.isEnabled ? <XCircle size={12} style={{ display: 'inline', marginRight: '4px' }} /> : <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                        {lang.isEnabled ? 'Devre Dışı' : 'Etkinleştir'}
                      </button>
                      {lang.isEnabled && (
                        <button
                          onClick={() => setConfirm({ lang, action: lang.isPublished ? 'unpublish' : 'publish' })}
                          style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid #D0D9E0',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px',
                            background: lang.isPublished ? '#F8FAFC' : '#EFF6FF',
                            color: lang.isPublished ? '#64748B' : '#1D4ED8',
                          }}
                        >
                          {lang.isPublished ? 'Yayından Kaldır' : 'Yayına Al'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif' }}>
            Eşleşen dil bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 3 — Çeviri İşleri (Bulk AI translate)
   ═══════════════════════════════════════════════════════════════════════════ */

/* Drizzle entity type values accepted by the AI endpoint */
type AiEntityType = 'content' | 'service_page' | 'faq' | 'vehicle' | 'navigation';

type AiResult = { lang: string; status: string; jobId?: string; error?: string };

function CevirilerIsleriTab({ langs, entitySources }: { langs: Lang[]; entitySources: EntitySources }) {
  const [entityType, setEntityType] = useState<AiEntityType>('content');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(
    langs.filter((l) => l.code !== 'tr' && l.isEnabled).map((l) => l.code),
  );
  const [loading, setLoading] = useState(false);
  const [perLangResults, setPerLangResults] = useState<AiResult[]>([]);
  /* langs that need force-confirm before overwriting manually edited translations */
  const [confirmLangs, setConfirmLangs] = useState<string[]>([]);
  const [forceLoading, setForceLoading] = useState(false);

  const activeLangs = langs.filter((l) => l.code !== 'tr' && l.isEnabled);

  /* The AI endpoint uses 'content' for both page and blog rows */
  const ENTITY_TYPES: Array<{ key: AiEntityType; sourceKey: keyof EntitySources; label: string }> = [
    { key: 'content',      sourceKey: 'content',      label: 'Sayfalar (İçerik)' },
    { key: 'service_page', sourceKey: 'service_page', label: 'Servis Sayfaları' },
    { key: 'content',      sourceKey: 'blog',         label: 'Blog Yazıları' },
    { key: 'faq',          sourceKey: 'faq',          label: 'SSS' },
    { key: 'vehicle',      sourceKey: 'vehicle',      label: 'Araçlar' },
    { key: 'navigation',   sourceKey: 'navigation',   label: 'Navigasyon' },
  ];

  const [sourceKey, setSourceKey] = useState<keyof EntitySources>('content');

  function handleEntityTypeChange(et: AiEntityType, sk: keyof EntitySources) {
    setEntityType(et);
    setSourceKey(sk);
    setSelectedEntityId('');
    setPerLangResults([]);
    setConfirmLangs([]);
  }

  const currentSources = entitySources[sourceKey] ?? [];

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  async function callAiEndpoint(codes: string[], force = false) {
    const res = await fetch('/admin/api/translations/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType,
        entityId: selectedEntityId,
        targetLanguageCodes: codes,
        force,
      }),
    });
    const data = await res.json();
    if (!res.ok && res.status !== 207) throw new Error(data.error ?? 'İstek başarısız');
    return data as { results: AiResult[]; needsConfirmation: string[]; summary: string };
  }

  async function runTranslate() {
    if (!selectedLangs.length || !selectedEntityId) return;
    setLoading(true);
    setPerLangResults([]);
    setConfirmLangs([]);
    try {
      const data = await callAiEndpoint(selectedLangs, false);
      setPerLangResults(data.results ?? []);
      if (data.needsConfirmation?.length) {
        setConfirmLangs(data.needsConfirmation);
      }
    } catch (e) {
      setPerLangResults([{ lang: '—', status: 'error', error: String(e) }]);
    } finally {
      setLoading(false);
    }
  }

  async function runForce() {
    if (!confirmLangs.length || !selectedEntityId) return;
    setForceLoading(true);
    try {
      const data = await callAiEndpoint(confirmLangs, true);
      setPerLangResults((prev) => {
        const map = new Map(prev.map((r) => [r.lang, r]));
        for (const r of data.results ?? []) map.set(r.lang, r);
        return Array.from(map.values());
      });
      setConfirmLangs([]);
    } catch (e) {
      alert('Zorla çeviri hatası: ' + String(e));
    } finally {
      setForceLoading(false);
    }
  }

  return (
    <div>
      <div style={{ ...card }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
          Toplu Yapay Zeka Çevirisi
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>
          Seçili içerik türü ve diller için eksik çevirileri AI ile otomatik oluşturun.
        </p>

        {/* Entity type */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: '#4B6375', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            İçerik Türü
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ENTITY_TYPES.map((et) => (
              <button key={et.sourceKey}
                onClick={() => handleEntityTypeChange(et.key, et.sourceKey)}
                style={{
                  padding: '7px 14px', borderRadius: '7px',
                  border: `1px solid ${sourceKey === et.sourceKey ? '#3B82F6' : '#D0D9E0'}`,
                  background: sourceKey === et.sourceKey ? '#EFF6FF' : '#fff',
                  color: sourceKey === et.sourceKey ? '#1D4ED8' : '#4B6375',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px',
                  fontWeight: sourceKey === et.sourceKey ? 600 : 400,
                }}
              >
                {et.label}
                <span style={{ marginLeft: '6px', fontSize: '11px', color: '#8AA0B0' }}>
                  ({entitySources[et.sourceKey].length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Entity selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: '#4B6375', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            İçerik Seç
          </label>
          {currentSources.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif' }}>
              Bu türde içerik bulunamadı.
            </p>
          ) : (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 36px 9px 12px', borderRadius: '8px',
                  border: `1px solid ${selectedEntityId ? '#3B82F6' : '#D0D9E0'}`,
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#1A2B3C',
                  background: '#fff', cursor: 'pointer', appearance: 'none',
                }}
              >
                <option value="">— İçerik seçin —</option>
                {currentSources.map((src) => (
                  <option key={src.id} value={src.id}>{src.title || src.slug || src.id}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8AA0B0', pointerEvents: 'none' }} />
            </div>
          )}
        </div>

        {/* Language selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: '#4B6375', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Hedef Diller
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {activeLangs.map((lang) => (
              <button key={lang.code}
                onClick={() => toggleLang(lang.code)}
                style={{
                  padding: '6px 12px', borderRadius: '7px',
                  border: `1px solid ${selectedLangs.includes(lang.code) ? '#16A34A' : '#D0D9E0'}`,
                  background: selectedLangs.includes(lang.code) ? '#ECFDF5' : '#fff',
                  color: selectedLangs.includes(lang.code) ? '#065F46' : '#60748A',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <span>{flag(lang.code)}</span>
                {lang.code.toUpperCase()}
                {selectedLangs.includes(lang.code) && <CheckCircle2 size={12} />}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runTranslate}
          disabled={loading || !selectedLangs.length || !selectedEntityId}
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: (loading || !selectedEntityId) ? '#93C5FD' : '#3B82F6',
            color: '#fff', cursor: (loading || !selectedEntityId) ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}
        >
          {loading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Çeviriliyor…</>
            : <><Sparkles size={14} /> Yapay Zeka ile Çevir</>}
        </button>
      </div>

      {/* Per-language results */}
      {perLangResults.length > 0 && (
        <div style={{ ...card }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
            Çeviri Sonuçları
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {perLangResults.map((r) => {
              const isDraft = r.status === 'draft';
              const isFailed = ['error', 'failed'].includes(r.status);
              const isNeedsConfirm = r.status === 'needs_confirmation';
              return (
                <div key={r.lang} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                  padding: '8px 12px', borderRadius: '8px',
                  background: isDraft ? '#F0FDF4' : isFailed ? '#FFF1F2' : '#FFFBEB',
                  border: `1px solid ${isDraft ? '#86EFAC' : isFailed ? '#FECDD3' : '#FDE68A'}`,
                }}>
                  <span style={{ fontSize: '16px' }}>{flag(r.lang)}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, color: '#1A2B3C', minWidth: '32px' }}>
                    {r.lang.toUpperCase()}
                  </span>
                  {isDraft && <CheckCircle2 size={13} style={{ color: '#16A34A' }} />}
                  {isFailed && <AlertCircle size={13} style={{ color: '#DC2626' }} />}
                  <span style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '12px',
                    color: isDraft ? '#15803D' : isFailed ? '#BE123C' : '#B45309',
                    flex: 1,
                  }}>
                    {isDraft ? 'Taslak oluşturuldu' :
                     isNeedsConfirm ? 'Elle düzenlenmiş — onay bekliyor' :
                     (r.error ?? r.status)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Force-confirm section */}
          {confirmLangs.length > 0 && (
            <div style={{ marginTop: '14px', padding: '14px', borderRadius: '8px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p style={{ margin: '0 0 10px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#78350F' }}>
                <strong>⚠ {confirmLangs.length} dil</strong> ({confirmLangs.map((c) => c.toUpperCase()).join(', ')}) için elle düzenlenmiş çeviriler mevcut. Bunların üzerine yazmak istiyor musunuz?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={runForce}
                  disabled={forceLoading}
                  style={{
                    padding: '7px 14px', borderRadius: '6px', border: 'none',
                    background: forceLoading ? '#FCA5A5' : '#DC2626',
                    color: '#fff', cursor: forceLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {forceLoading
                    ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> İşleniyor…</>
                    : 'Üzerine Yaz'}
                </button>
                <button
                  onClick={() => setConfirmLangs([])}
                  style={{
                    padding: '7px 14px', borderRadius: '6px', border: '1px solid #D0D9E0',
                    background: '#fff', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#4B6375',
                  }}
                >
                  İptal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info card */}
      <div style={{ ...card, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertCircle size={16} style={{ color: '#0284C7', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 6px', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#075985' }}>
              Toplu çeviri nasıl çalışır?
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0369A1' }}>
              <li>Eksik veya güncellenmesi gereken çeviriler tespit edilir</li>
              <li>OpenAI GPT ile kaynak Türkçe içerik hedef dile çevrilir</li>
              <li>Oluşturulan çeviriler <strong>Taslak</strong> olarak eklenir</li>
              <li>Onay sonrası &ldquo;İçerik Çevirileri&rdquo; sekmesinden yayına alabilirsiniz</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 4 — İçerik Çevirileri (filterable job list)
   ═══════════════════════════════════════════════════════════════════════════ */

const ENTITY_FILTER_TABS = [
  { key: '', label: 'Tümü' },
  { key: 'page', label: 'Sayfalar' },
  { key: 'blog', label: 'Blog' },
  { key: 'service_page', label: 'Servisler' },
  { key: 'faq', label: 'SSS' },
  { key: 'vehicle', label: 'Araçlar' },
  { key: 'navigation', label: 'Navigasyon' },
];

const STATUS_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  QUEUED:      { label: 'Sırada',       bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  TRANSLATING: { label: 'Çevriliyor',   bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  DRAFT:       { label: 'Taslak',       bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  REVIEW:      { label: 'İncelemede',   bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  APPROVED:    { label: 'Onaylı',       bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  SCHEDULED:   { label: 'Zamanlandı',   bg: '#F0F9FF', color: '#075985', border: '#BAE6FD' },
  PUBLISHED:   { label: 'Yayında',      bg: '#F0FDF4', color: '#166534', border: '#86EFAC' },
  ARCHIVED:    { label: 'Arşiv',        bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0' },
  FAILED:      { label: 'Başarısız',    bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  OUTDATED:    { label: 'Güncel Değil', bg: '#FFF7ED', color: '#C2410C', border: '#FDBA74' },
};

function IcerikCevirileriTab({ jobs, total, page, limit, entityTypeFilter, langFilter, langs }: {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  entityTypeFilter: string;
  langFilter: string;
  langs: Lang[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [localJobs, setLocalJobs] = useState<Job[]>(jobs);

  const base = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab: 'icerik-cevirileri', ...extra });
    if (entityTypeFilter && !extra.entityType) p.set('entityType', entityTypeFilter);
    if (langFilter && !extra.lang) p.set('lang', langFilter);
    return `/admin/dil-ve-ceviri?${p.toString()}`;
  };

  async function doAction(id: string, action: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/admin/api/translations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setLocalJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...data.item } : j));
    } catch (e) {
      alert('Hata: ' + String(e));
    } finally {
      setLoadingId(null);
    }
  }

  const filterUrl = (etKey: string) => {
    const p = new URLSearchParams({ tab: 'icerik-cevirileri' });
    if (etKey) p.set('entityType', etKey);
    if (langFilter) p.set('lang', langFilter);
    return `/admin/dil-ve-ceviri?${p.toString()}`;
  };

  const langFilterUrl = (code: string) => {
    const p = new URLSearchParams({ tab: 'icerik-cevirileri' });
    if (entityTypeFilter) p.set('entityType', entityTypeFilter);
    if (code) p.set('lang', code);
    return `/admin/dil-ve-ceviri?${p.toString()}`;
  };

  return (
    <div>
      {/* Entity type filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', overflowX: 'auto' }}>
        {ENTITY_FILTER_TABS.map((f) => (
          <a key={f.key} href={filterUrl(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '6px', textDecoration: 'none',
              border: '1px solid #D0D9E0', fontFamily: 'Inter, sans-serif', fontSize: '12px',
              background: entityTypeFilter === f.key ? '#3B82F6' : '#fff',
              color: entityTypeFilter === f.key ? '#fff' : '#4B6375',
              whiteSpace: 'nowrap',
            }}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Language filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <a href={langFilterUrl('')}
          style={{
            padding: '5px 12px', borderRadius: '6px', textDecoration: 'none',
            border: '1px solid #D0D9E0', fontFamily: 'Inter, sans-serif', fontSize: '12px',
            background: !langFilter ? '#EFF6FF' : '#fff',
            color: !langFilter ? '#1D4ED8' : '#4B6375',
          }}
        >
          Tüm Diller
        </a>
        {langs.filter((l) => l.code !== 'tr' && l.isEnabled).map((lang) => (
          <a key={lang.code} href={langFilterUrl(lang.code)}
            style={{
              padding: '5px 12px', borderRadius: '6px', textDecoration: 'none',
              border: '1px solid #D0D9E0', fontFamily: 'Inter, sans-serif', fontSize: '12px',
              background: langFilter === lang.code ? '#EFF6FF' : '#fff',
              color: langFilter === lang.code ? '#1D4ED8' : '#4B6375',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <span>{flag(lang.code)}</span> {lang.code.toUpperCase()}
          </a>
        ))}
      </div>

      {/* Summary */}
      <div style={{ fontSize: '13px', color: '#60748A', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
        {total} kayıt bulundu
        {entityTypeFilter && ` · ${ENTITY_FILTER_TABS.find((f) => f.key === entityTypeFilter)?.label}`}
        {langFilter && ` · ${langs.find((l) => l.code === langFilter)?.nativeName ?? langFilter.toUpperCase()}`}
      </div>

      {/* Job list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {localJobs.map((job) => {
          const sm = STATUS_META[job.status] ?? STATUS_META.DRAFT;
          const isLoading = loadingId === job.id;
          return (
            <div key={job.id} style={{ ...card, marginBottom: 0, padding: '14px 16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                {/* Left: entity info */}
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#1A2B3C', fontFamily: 'Inter, sans-serif', marginBottom: '2px' }}>
                    {job.sourceTitle || job.title || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{job.entityType}</span>
                    {job.sourceSlug && <span>· /{job.sourceSlug}</span>}
                    {job.isAiGenerated && <span>· 🤖 AI</span>}
                  </div>
                </div>

                {/* Middle: lang + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px' }}>{flag(job.targetLanguageCode)}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#4B6375', fontFamily: 'Inter, sans-serif' }}>
                    {job.targetLanguageCode.toUpperCase()}
                  </span>
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Inter, sans-serif',
                    background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
                  }}>
                    {sm.label}
                  </span>
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {isLoading ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#3B82F6' }} />
                  ) : (
                    <>
                      {job.status === 'DRAFT' && (
                        <ABtn onClick={() => doAction(job.id, 'submit_review')} bg="#FFF7ED" color="#C2410C" border="#FDBA74">
                          İncelemeye Gönder
                        </ABtn>
                      )}
                      {job.status === 'REVIEW' && (
                        <ABtn onClick={() => doAction(job.id, 'approve')} bg="#ECFDF5" color="#065F46" border="#A7F3D0">
                          Onayla
                        </ABtn>
                      )}
                      {job.status === 'APPROVED' && (
                        <ABtn onClick={() => doAction(job.id, 'publish')} bg="#F0FDF4" color="#166534" border="#86EFAC">
                          Yayınla
                        </ABtn>
                      )}
                      {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
                        <ABtn onClick={() => doAction(job.id, 'archive')} bg="#F1F5F9" color="#64748B" border="#CBD5E1">
                          <Archive size={11} /> Arşiv
                        </ABtn>
                      )}
                      {job.status === 'FAILED' && (
                        <ABtn onClick={() => doAction(job.id, 'submit_review')} bg="#EFF6FF" color="#1D4ED8" border="#BFDBFE">
                          <RefreshCw size={11} /> İncelemeye Al
                        </ABtn>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {localJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif' }}>
            Bu filtre için çeviri işi bulunamadı.
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '13px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>
          <span>{total} kayıt · Sayfa {page}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {page > 1 && (
              <a href={base({ page: String(page - 1) })}
                style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', display: 'flex', alignItems: 'center', minHeight: '34px' }}>
                ← Önceki
              </a>
            )}
            {page * limit < total && (
              <a href={base({ page: String(page + 1) })}
                style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', display: 'flex', alignItems: 'center', minHeight: '34px' }}>
                Sonraki →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Tiny action button */
function ABtn({ onClick, bg, color, border, children }: {
  onClick: () => void; bg: string; color: string; border: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
        border: `1px solid ${border}`, background: bg, color,
        fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 5 — Ayarlar
   ═══════════════════════════════════════════════════════════════════════════ */

function AyarlarTab({ langs }: { langs: Lang[] }) {
  const activeLangs    = langs.filter((l) => l.isEnabled);
  const publishedLangs = langs.filter((l) => l.isPublished);

  return (
    <div>
      {/* AI provider info */}
      <div style={{ ...card }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: '#1A2B3C', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} style={{ color: '#7C3AED' }} /> Yapay Zeka Çeviri Motoru
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Sağlayıcı', value: 'OpenAI' },
            { label: 'Model', value: 'GPT-4o' },
            { label: 'Kaynak Dil', value: '🇹🇷 Türkçe (tr)' },
            { label: 'Yönetim', value: 'Replit Entegrasyonu' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2EAF0' }}>
              <div style={{ fontSize: '11px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2B3C', fontFamily: 'Inter, sans-serif' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#8AA0B0', fontFamily: 'Inter, sans-serif' }}>
          API anahtarı ve model değişiklikleri için Replit Secrets panelini kullanın.
        </p>
      </div>

      {/* Language status summary */}
      <div style={{ ...card }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700, color: '#1A2B3C', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={15} style={{ color: '#3B82F6' }} /> Dil Durumu
        </h3>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3B82F6', fontFamily: 'Inter, sans-serif' }}>{activeLangs.length}</div>
            <div style={{ fontSize: '12px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>Aktif Dil</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#16A34A', fontFamily: 'Inter, sans-serif' }}>{publishedLangs.length}</div>
            <div style={{ fontSize: '12px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>Yayında Dil</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#D97706', fontFamily: 'Inter, sans-serif' }}>{langs.length}</div>
            <div style={{ fontSize: '12px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>Toplam Katalog</div>
          </div>
        </div>

        {/* Published langs list */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {publishedLangs.map((lang) => (
            <div key={lang.code} style={{
              padding: '6px 12px', borderRadius: '20px', fontSize: '13px',
              fontFamily: 'Inter, sans-serif', background: '#ECFDF5',
              color: '#065F46', border: '1px solid #A7F3D0',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span>{flag(lang.code)}</span>
              <span>{lang.nativeName || lang.name}</span>
              <CheckCircle2 size={12} />
            </div>
          ))}
        </div>
      </div>

      {/* Workflow info */}
      <div style={{ ...card, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: '#075985', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRight size={15} /> Çeviri İş Akışı
        </h3>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#0369A1', fontFamily: 'Inter, sans-serif', lineHeight: '1.8' }}>
          <li>İçerik Türkçe olarak yazılır ve yayına alınır</li>
          <li><strong>Çeviri İşleri</strong> sekmesinden toplu AI çevirisi tetiklenir</li>
          <li>Çeviriler <strong>Taslak</strong> → <strong>İncelemede</strong> → <strong>Onaylı</strong> akışından geçer</li>
          <li>Onaylı çeviriler <strong>Yayına Al</strong> ile sitede görünür hale gelir</li>
          <li>Sitemap ve hreflang etiketleri yayına alınan dilleri otomatik içerir</li>
        </ol>
      </div>
    </div>
  );
}
