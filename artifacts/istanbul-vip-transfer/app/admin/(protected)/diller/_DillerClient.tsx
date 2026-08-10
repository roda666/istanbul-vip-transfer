'use client';

/**
 * Language catalog management client.
 * - Search by Turkish name / native name / locale code
 * - Filters: Tümü, Aktif Kamu, Pasif, Taslak Çeviri, Yayınlanmış, LTR, RTL, Sağlayıcı Desteklemiyor
 * - Pagination (20 per page)
 * - Confirmed enable/disable + publish/unpublish actions
 * - Mobile (≤767px): card layout, no horizontal overflow at 390px
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Search, Lock } from 'lucide-react';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import type { Language } from '@/db/schema';
import type { LangTranslationStats } from './page';

/** Languages whose public UI dictionaries exist — only these can be published. */
const RENDERABLE_LANGS: readonly string[] = ['tr', ...SUPPORTED_LANGS];

type FilterKey = 'all' | 'active' | 'passive' | 'draft' | 'published' | 'ltr' | 'rtl' | 'unsupported';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif Kamu' },
  { key: 'passive', label: 'Pasif' },
  { key: 'draft', label: 'Taslak Çeviri' },
  { key: 'published', label: 'Yayınlanmış' },
  { key: 'ltr', label: 'LTR' },
  { key: 'rtl', label: 'RTL' },
  { key: 'unsupported', label: 'Sağlayıcı Desteklemiyor' },
];

const PAGE_SIZE = 20;

type ConfirmAction = {
  lang: Language;
  field: 'isEnabled' | 'isPublished';
  nextValue: boolean;
  title: string;
  message: string;
};

const STYLE = `
  .dl-table-wrap { display: block; overflow-x: auto; }
  .dl-cards      { display: none; }
  @media (max-width: 767px) {
    .dl-table-wrap { display: none !important; }
    .dl-cards      { display: flex !important; flex-direction: column; gap: 10px; }
    .dl-toolbar    { flex-direction: column; align-items: stretch !important; }
    .dl-search input { font-size: 16px !important; }
  }
  .dl-card {
    background: #FFFFFF; border: 1px solid #E8EDF3; border-radius: 12px;
    padding: 14px 16px; box-shadow: 0 1px 4px rgba(16,42,67,0.05);
    min-width: 0; overflow-wrap: anywhere;
  }
  .dl-chip {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px;
    display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
  }
  .dl-btn {
    padding: 6px 10px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 11px; font-weight: 600; font-family: Inter, sans-serif;
    display: inline-flex; align-items: center; gap: 4px; min-height: 32px;
  }
  .dl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .dl-filter-btn {
    padding: 5px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600;
    font-family: Inter, sans-serif; cursor: pointer; white-space: nowrap;
  }
`;

function Chip({ bg, color, border, children }: { bg: string; color: string; border: string; children: React.ReactNode }) {
  return <span className="dl-chip" style={{ background: bg, color, border: `1px solid ${border}` }}>{children}</span>;
}

function PublicStatusChip({ lang }: { lang: Language }) {
  if (!lang.providerSupported) return <Chip bg="#F1F5F9" color="#64748B" border="#CBD5E1">Kullanılamaz</Chip>;
  if (lang.isEnabled && lang.isPublished) return <Chip bg="#F0FDF4" color="#166534" border="#86EFAC">Kamuya Açık</Chip>;
  if (lang.isEnabled) return <Chip bg="#FFFBEB" color="#92400E" border="#FDE68A">Aktif (Yayında Değil)</Chip>;
  return <Chip bg="#F8FAFC" color="#6B7A8A" border="#D9E2EC">Pasif</Chip>;
}

function TranslationStatusChip({ stat }: { stat?: { draft: number; published: number } }) {
  if (!stat || (stat.draft === 0 && stat.published === 0))
    return <span style={{ fontSize: '11px', color: '#8899AA' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
      {stat.published > 0 && <Chip bg="#F0FDF4" color="#166534" border="#86EFAC">{stat.published} yayında</Chip>}
      {stat.draft > 0 && <Chip bg="#F8FAFC" color="#475569" border="#CBD5E1">{stat.draft} taslak</Chip>}
    </span>
  );
}

interface Props {
  langs: Language[];
  stats: LangTranslationStats;
}

export default function DillerClient({ langs: initialLangs, stats }: Props) {
  const router = useRouter();
  const [langs, setLangs] = useState(initialLangs);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return langs.filter((l) => {
      if (q) {
        const hay = [l.turkishName ?? '', l.name, l.nativeName, l.code, l.locale]
          .join(' ')
          .toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      const stat = stats[l.code];
      switch (filter) {
        case 'active': return l.isEnabled && l.isPublished;
        case 'passive': return !l.isEnabled;
        case 'draft': return (stat?.draft ?? 0) > 0;
        case 'published': return (stat?.published ?? 0) > 0;
        case 'ltr': return l.direction === 'ltr';
        case 'rtl': return l.direction === 'rtl';
        case 'unsupported': return !l.providerSupported;
        default: return true;
      }
    });
  }, [langs, query, filter, stats]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function apply(action: ConfirmAction) {
    setConfirm(null);
    setLoading(action.lang.id);
    setError(null);
    try {
      const res = await fetch(`/admin/api/languages/${action.lang.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [action.field]: action.nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'İşlem başarısız');
      const item = (data as { item: Language }).item;
      setLangs((prev) => prev.map((l) => (l.id === item.id ? item : l)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  function requestToggleEnabled(lang: Language) {
    const enabling = !lang.isEnabled;
    setConfirm({
      lang,
      field: 'isEnabled',
      nextValue: enabling,
      title: enabling ? 'Dili Etkinleştir' : 'Dili Devre Dışı Bırak',
      message: enabling
        ? `${lang.turkishName ?? lang.name} (${lang.code}) etkinleştirilecek. Etkin diller için adminde çeviri taslakları hazırlanabilir; siz ayrıca yayınlamadıkça kamuya açılmaz.`
        : `${lang.turkishName ?? lang.name} (${lang.code}) devre dışı bırakılacak ve yayından kaldırılacak. Dil seçici, sitemap ve hreflang çıktısından çıkarılır; mevcut çeviriler SİLİNMEZ.`,
    });
  }

  function requestTogglePublished(lang: Language) {
    const publishing = !lang.isPublished;
    setConfirm({
      lang,
      field: 'isPublished',
      nextValue: publishing,
      title: publishing ? 'Dili Yayınla' : 'Yayından Kaldır',
      message: publishing
        ? `${lang.turkishName ?? lang.name} (${lang.code}) kamuya açılacak: dil seçici, sitemap ve hreflang çıktısına eklenir.`
        : `${lang.turkishName ?? lang.name} (${lang.code}) yayından kaldırılacak ve kamuya kapatılacak. Çeviriler adminde korunur.`,
    });
  }

  const activeCount = langs.filter((l) => l.isEnabled && l.isPublished).length;

  function Actions({ lang }: { lang: Language }) {
    const isTr = lang.code === 'tr';
    const busy = loading === lang.id;
    if (isTr) {
      return (
        <span style={{ fontSize: '11px', color: '#50677A', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Lock size={11} /> Kaynak dil — kilitli
        </span>
      );
    }
    if (!lang.providerSupported) {
      return <span style={{ fontSize: '11px', color: '#8899AA', fontStyle: 'italic' }}>Kullanılamaz</span>;
    }
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          className="dl-btn"
          disabled={busy}
          onClick={() => requestToggleEnabled(lang)}
          style={{ background: lang.isEnabled ? '#FEF2F2' : '#ECFDF5', color: lang.isEnabled ? '#991B1B' : '#065F46' }}
        >
          {lang.isEnabled ? 'Devre Dışı' : 'Etkinleştir'}
        </button>
        {lang.isEnabled && (RENDERABLE_LANGS.includes(lang.code) || lang.isPublished ? (
          <button
            className="dl-btn"
            disabled={busy}
            onClick={() => requestTogglePublished(lang)}
            style={{ background: lang.isPublished ? '#FFF7ED' : '#EFF6FF', color: lang.isPublished ? '#C2410C' : '#1E40AF' }}
          >
            {lang.isPublished ? 'Yayından Kaldır' : 'Yayınla'}
          </button>
        ) : (
          <span
            title="Site arayüzü sözlüğü henüz hazır değil — yayınlanamaz. Çeviri taslakları hazırlanabilir."
            style={{ fontSize: '11px', color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '9999px', padding: '4px 10px', whiteSpace: 'nowrap' }}
          >
            Sözlük hazır değil
          </span>
        ))}
      </div>
    );
  }

  return (
    <div>
      <style>{STYLE}</style>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px' }}>
        <strong>Katalog:</strong> {langs.length} dil · {activeCount} kamuya açık. Türkçe kaynak dildir ve kilitlidir.
        Yeni bir dil yalnızca etkinleştirilip <strong>yayınlandığında</strong> kamuya açılır.
      </div>

      {/* Toolbar: search + filters */}
      <div className="dl-toolbar" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', fontFamily: 'Inter, sans-serif' }}>
        <div className="dl-search" style={{ position: 'relative', flex: '0 1 300px', minWidth: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8899AA' }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Dil, yerel ad veya locale kodu ara…"
            style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid #D9E2EC', fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFF', color: '#1A2B3C' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="dl-filter-btn"
              onClick={() => { setFilter(f.key); setPage(1); }}
              style={{
                background: filter === f.key ? '#1A2B3C' : '#FFF',
                color: filter === f.key ? '#FFF' : '#50677A',
                border: `1px solid ${filter === f.key ? '#1A2B3C' : '#D9E2EC'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#8899AA', fontFamily: 'Inter, sans-serif', margin: '0 0 10px' }}>
        {filtered.length} dil gösteriliyor
      </p>

      {/* Desktop table */}
      <div className="dl-table-wrap rounded-xl" style={{ border: '1px solid #E8EDF3', borderRadius: '12px', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDF3' }}>
              {['Dil', 'Yerel Ad', 'Locale', 'Yön', 'Çeviri Desteği', 'Kamu Durumu', 'Çeviri Durumu', 'İşlemler'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#60758A', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((lang, i) => (
              <tr key={lang.id} style={{ borderBottom: i === pageRows.length - 1 ? 'none' : '1px solid #F1F4F8', background: '#FFF', opacity: loading === lang.id ? 0.6 : 1 }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={13} style={{ color: '#C99A32', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, fontSize: '13px', color: '#1A2B3C' }}>{lang.turkishName ?? lang.name}</span>
                    {lang.isDefault && <Chip bg="#EFF6FF" color="#1E40AF" border="#BFDBFE">Varsayılan</Chip>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8899AA', marginTop: '2px' }}>{lang.name}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: '13px', color: '#263F55' }} dir={lang.direction}>{lang.nativeName}</td>
                <td style={{ padding: '10px 12px' }}>
                  <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>{lang.locale}</code>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {lang.direction === 'rtl'
                    ? <Chip bg="#FEF9C3" color="#854D0E" border="#FDE68A">RTL</Chip>
                    : <Chip bg="#F0FDF4" color="#166534" border="#BBF7D0">LTR</Chip>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {lang.providerSupported
                    ? <Chip bg="#ECFDF5" color="#065F46" border="#A7F3D0">Destekleniyor</Chip>
                    : <Chip bg="#FEF2F2" color="#991B1B" border="#FECACA">Desteklenmiyor</Chip>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {lang.code === 'tr'
                    ? <Chip bg="#EFF6FF" color="#1E40AF" border="#BFDBFE">Kaynak Dil</Chip>
                    : <PublicStatusChip lang={lang} />}
                </td>
                <td style={{ padding: '10px 12px' }}><TranslationStatusChip stat={stats[lang.code]} /></td>
                <td style={{ padding: '10px 12px' }}><Actions lang={lang} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="dl-cards">
        {pageRows.map((lang) => (
          <div key={lang.id} className="dl-card" style={{ opacity: loading === lang.id ? 0.6 : 1, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2B3C', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {lang.turkishName ?? lang.name}
                  {lang.isDefault && <Chip bg="#EFF6FF" color="#1E40AF" border="#BFDBFE">Varsayılan</Chip>}
                </div>
                <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '2px' }} dir={lang.direction}>
                  {lang.nativeName} · <code>{lang.locale}</code>
                </div>
              </div>
              {lang.code === 'tr'
                ? <Chip bg="#EFF6FF" color="#1E40AF" border="#BFDBFE">Kaynak</Chip>
                : <PublicStatusChip lang={lang} />}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {lang.direction === 'rtl'
                ? <Chip bg="#FEF9C3" color="#854D0E" border="#FDE68A">RTL</Chip>
                : <Chip bg="#F0FDF4" color="#166534" border="#BBF7D0">LTR</Chip>}
              {lang.providerSupported
                ? <Chip bg="#ECFDF5" color="#065F46" border="#A7F3D0">Çeviri: Destekleniyor</Chip>
                : <Chip bg="#FEF2F2" color="#991B1B" border="#FECACA">Çeviri: Desteklenmiyor</Chip>}
              <TranslationStatusChip stat={stats[lang.code]} />
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              <Actions lang={lang} />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#50677A' }}>
          <span>Sayfa {safePage} / {totalPages}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="dl-btn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} style={{ background: '#FFF', border: '1px solid #D9E2EC', color: '#263F55' }}>← Önceki</button>
            <button className="dl-btn" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} style={{ background: '#FFF', border: '1px solid #D9E2EC', color: '#263F55' }}>Sonraki →</button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'Inter, sans-serif' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2B3C', marginBottom: '10px' }}>{confirm.title}</h3>
            <p style={{ fontSize: '13px', color: '#50677A', lineHeight: 1.6, marginBottom: '20px' }}>{confirm.message}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D9E2EC', background: '#FFF', cursor: 'pointer', fontSize: '13px' }}>
                İptal
              </button>
              <button onClick={() => apply(confirm)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFF', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
