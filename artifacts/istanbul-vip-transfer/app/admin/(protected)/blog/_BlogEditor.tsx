'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BlogAdminRecord } from '@/lib/blog-cms';
import { ImageUploadField } from '@/app/admin/_components/ImageUploadField';

// ── Safe JSON fetch ─────────────────────────────────────────────────────────
async function safeJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const ct   = res.headers.get('content-type') ?? '';
  if (!text.trim()) throw new Error(`Sunucu boş yanıt döndürdü (HTTP ${res.status}).`);
  if (!ct.includes('json')) throw new Error(`Beklenmeyen yanıt (HTTP ${res.status}): ${text.slice(0, 120)}`);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`JSON hatası (HTTP ${res.status}): ${text.slice(0, 120)}`); }
}

// ── Status configs ───────────────────────────────────────────────────────────

const SRC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  IDEA:      { label: 'Fikir',    color: '#7C3AED', bg: '#F5F3FF' },
  DRAFT:     { label: 'Taslak',  color: '#9333EA', bg: '#FAF5FF' },
  RESEARCH:  { label: 'Araştırma', color: '#D97706', bg: '#FFFBEB' },
  REVIEW:    { label: 'İnceleme', color: '#2563EB', bg: '#EFF6FF' },
  APPROVED:  { label: 'Onaylandı', color: '#0891B2', bg: '#ECFEFF' },
  SCHEDULED: { label: 'Planlandı', color: '#7C3AED', bg: '#F5F3FF' },
  PUBLISHED: { label: 'Yayında',  color: '#059669', bg: '#ECFDF5' },
  OUTDATED:  { label: 'Güncellenmeli', color: '#EA580C', bg: '#FFF7ED' },
  ARCHIVED:  { label: 'Arşiv',   color: '#64748B', bg: '#F1F5F9' },
};

const TX_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  NOT_STARTED: { label: 'Başlamadı',    color: '#94A3B8', bg: '#F8FAFC' },
  QUEUED:      { label: 'Kuyrukta',     color: '#D97706', bg: '#FFFBEB' },
  TRANSLATING: { label: 'Çevriliyor…', color: '#2563EB', bg: '#EFF6FF' },
  DRAFT:       { label: 'Taslak',       color: '#9333EA', bg: '#FAF5FF' },
  REVIEW:      { label: 'İnceleme',     color: '#2563EB', bg: '#EFF6FF' },
  APPROVED:    { label: 'Onaylandı',    color: '#0891B2', bg: '#ECFEFF' },
  PUBLISHED:   { label: 'Yayında',      color: '#059669', bg: '#ECFDF5' },
  OUTDATED:    { label: 'Güncellenmeli',color: '#EA580C', bg: '#FFF7ED' },
  ARCHIVED:    { label: 'Arşiv',        color: '#64748B', bg: '#F1F5F9' },
  FAILED:      { label: 'Hata',         color: '#DC2626', bg: '#FEF2F2' },
};

const LOCALES: { code: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: '🇬🇧 English',    dir: 'ltr' },
  { code: 'de', label: '🇩🇪 Deutsch',    dir: 'ltr' },
  { code: 'ru', label: '🇷🇺 Русский',    dir: 'ltr' },
  { code: 'ar', label: '🇸🇦 العربية',    dir: 'rtl' },
  { code: 'es', label: '🇪🇸 Español',    dir: 'ltr' },
  { code: 'fr', label: '🇫🇷 Français',   dir: 'ltr' },
  { code: 'it', label: '🇮🇹 Italiano',   dir: 'ltr' },
  { code: 'nl', label: '🇳🇱 Nederlands', dir: 'ltr' },
];

const CATEGORIES = [
  'Transfer Rehberi', 'VIP Ulaşım', 'Araç Rehberi', 'Şehir Rehberi',
  'Kurumsal Seyahat', 'Sağlık Turizmi', 'Havalimanı Rehberi', 'İpuçları',
];

// ── Style helpers ────────────────────────────────────────────────────────────

const s = {
  inp: (dir?: string): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
    borderRadius: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
    color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box',
    direction: dir as React.CSSProperties['direction'],
  }),
  ta: (dir?: string, rows = 4): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
    borderRadius: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
    color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box',
    resize: 'vertical', minHeight: `${rows * 22 + 16}px`,
    direction: dir as React.CSSProperties['direction'],
  }),
  lbl: { fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: '4px' } as React.CSSProperties,
  hint: { fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  fld: { marginBottom: '16px' } as React.CSSProperties,
  btn: (c: string, bg: string, border?: string): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', border: border ?? 'none', color: c, background: bg, fontFamily: 'Inter, sans-serif',
  }),
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, map }: { status: string; map: typeof SRC_STATUS }) {
  const cfg = map[status] ?? { label: status, color: '#64748B', bg: '#F1F5F9' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function Field({ label, value, onChange, multiline, rows, dir, hint, maxLen, readOnly, type }: {
  label: string; value: string; onChange?: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string; maxLen?: number; readOnly?: boolean;
  type?: string;
}) {
  const over  = maxLen !== undefined && value.length > maxLen;
  const near  = maxLen !== undefined && !over && value.length > Math.floor(maxLen * 0.85);
  return (
    <div style={s.fld}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <label style={{ ...s.lbl, marginBottom: 0 }}>{label}</label>
        {maxLen !== undefined && (
          <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', color: over ? '#DC2626' : near ? '#D97706' : '#94A3B8', fontWeight: over ? 700 : 400 }}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      {multiline
        ? <textarea style={{ ...s.ta(dir, rows), borderColor: over ? '#EF4444' : undefined, opacity: readOnly ? 0.6 : 1 }}
            value={value} onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
        : <input type={type ?? 'text'} style={{ ...s.inp(dir), borderColor: over ? '#EF4444' : undefined, opacity: readOnly ? 0.6 : 1 }}
            value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} />
      }
      {hint && <p style={s.hint}>{hint}</p>}
    </div>
  );
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');
  function add() {
    const t = inputVal.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInputVal('');
  }
  function remove(tag: string) { onChange(tags.filter(t => t !== tag)); }
  return (
    <div style={s.fld}>
      <label style={s.lbl}>Etiketler</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', minHeight: '28px' }}>
        {tags.map(tag => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '4px', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            {tag}
            <button onClick={() => remove(tag)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1D4ED8', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Etiket ekle (Enter ile onayla)" style={{ ...s.inp(), flex: 1 }} />
        <button onClick={add} style={s.btn('#FFFFFF', '#2563EB')}>Ekle</button>
      </div>
      <p style={s.hint}>Etiket eklemek için yazıp Enter&apos;a basın.</p>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TxFieldState = Record<string, {
  title: string; slug: string; excerpt: string; body: string;
  metaTitle: string; metaDescription: string; dirty: boolean;
}>;

// ── Main BlogEditor ──────────────────────────────────────────────────────────

interface Props { blogId: string; initial: BlogAdminRecord; }

export default function BlogEditor({ blogId, initial }: Props) {
  // ── Source state ─────────────────────────────────────────────────────────
  const [rec,        setRec]        = useState<BlogAdminRecord>(initial);
  const [activeTab,  setActiveTab]  = useState<'tr' | string>('tr');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [lastSaved,  setLastSaved]  = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);

  // Source fields
  const [title,          setTitle]          = useState(initial.title);
  const [slug,           setSlug]           = useState(initial.slug);
  const [excerpt,        setExcerpt]        = useState(initial.excerpt ?? '');
  const [body,           setBody]           = useState(initial.body ?? '');
  const [category,       setCategory]       = useState(initial.category ?? '');
  const [author,         setAuthor]         = useState(initial.author ?? '');
  const [tags,           setTags]           = useState<string[]>(initial.tags ?? []);
  const [readTime,       setReadTime]       = useState<number | ''>(initial.readTimeMinutes ?? '');
  const [heroImage,      setHeroImage]      = useState(initial.heroImage ?? '');
  const [heroImageAlt,   setHeroImageAlt]   = useState(initial.heroImageAlt ?? '');
  const [ogImage,        setOgImage]        = useState(initial.ogImage ?? '');
  const [seoTitle,       setSeoTitle]       = useState(initial.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? '');
  const [ogTitle,        setOgTitle]        = useState(initial.ogTitle ?? '');
  const [ogDescription,  setOgDescription]  = useState(initial.ogDescription ?? '');
  const [canonicalUrl,   setCanonicalUrl]   = useState(initial.canonicalUrl ?? '');
  const [scheduledAt,    setScheduledAt]    = useState(initial.scheduledAt ? initial.scheduledAt.slice(0, 16) : '');

  // Translation field state (by locale)
  const [txFields, setTxFields] = useState<TxFieldState>(() => {
    const out: TxFieldState = {};
    for (const tx of initial.translations) {
      out[tx.locale] = {
        title: tx.title ?? '', slug: tx.slug ?? '', excerpt: tx.excerpt ?? '',
        body: tx.body ?? '', metaTitle: tx.metaTitle ?? '', metaDescription: tx.metaDescription ?? '',
        dirty: false,
      };
    }
    return out;
  });

  // Auto-calc read time from body
  const autoReadTime = Math.max(1, Math.ceil(body.split(/\s+/).filter(Boolean).length / 200));

  // Auto-generate slug from title
  function autoSlug() {
    const gen = title.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 180);
    setSlug(gen);
  }

  // ── Autosave ──────────────────────────────────────────────────────────────
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);

  function markDirty() { isDirty.current = true; }

  const saveSource = useCallback(async (opts: { saveAsDraft?: boolean; newStatus?: string } = {}) => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, slug, excerpt: excerpt || null, body,
          heroImage: heroImage || null, heroImageAlt: heroImageAlt || null,
          ogImage: ogImage || null,
          category: category || null, author: author || null, tags,
          readTimeMinutes: readTime !== '' ? Number(readTime) : autoReadTime,
          ogTitle: ogTitle || null, ogDescription: ogDescription || null,
          seoTitle: seoTitle || null, seoDescription: seoDescription || null,
          canonicalUrl: canonicalUrl || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          saveAsDraft: opts.saveAsDraft ?? false,
          newStatus: opts.newStatus,
        }),
      });
      const json = await safeJson<{ record?: BlogAdminRecord; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Kaydetme hatası.');
      if (json.record) setRec(json.record);
      isDirty.current = false;
      setLastSaved(new Date().toLocaleTimeString('tr-TR'));
      setSuccess(opts.saveAsDraft ? 'Taslak kaydedildi.' : 'Kaydedildi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }, [title, slug, excerpt, body, heroImage, heroImageAlt, ogImage, category, author, tags, readTime, autoReadTime, ogTitle, ogDescription, seoTitle, seoDescription, canonicalUrl, scheduledAt, blogId]);

  // Autosave timer
  useEffect(() => {
    if (!isDirty.current) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      if (isDirty.current) saveSource({ saveAsDraft: rec.status === 'PUBLISHED' });
    }, 30_000);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [title, slug, excerpt, body, category, author, tags, readTime, heroImage, heroImageAlt, seoTitle, seoDescription, ogTitle, ogDescription, saveSource, rec.status]);

  // ── Source status actions ─────────────────────────────────────────────────
  async function sourceAction(action: string, extra?: Record<string, unknown>) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await safeJson<{ record?: BlogAdminRecord; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'İşlem hatası.');
      if (json.record) setRec(json.record);
      setSuccess('Durum güncellendi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }

  // ── Translation save ──────────────────────────────────────────────────────
  async function saveTx(locale: string) {
    const f = txFields[locale];
    if (!f) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveTx', locale,
          title: f.title || null, slug: f.slug || null,
          excerpt: f.excerpt || null, body: f.body || null,
          metaTitle: f.metaTitle || null, metaDescription: f.metaDescription || null,
        }),
      });
      const json = await safeJson<{ record?: BlogAdminRecord; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Kaydetme hatası.');
      if (json.record) {
        setRec(json.record);
        setTxFields(prev => ({
          ...prev,
          [locale]: { ...prev[locale], dirty: false },
        }));
      }
      setSuccess('Çeviri kaydedildi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }

  // ── Translation workflow action ────────────────────────────────────────────
  async function txAction(locale: string, action: string) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, locale }),
      });
      const json = await safeJson<{ record?: BlogAdminRecord; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'İşlem hatası.');
      if (json.record) setRec(json.record);
      setSuccess('İşlem tamamlandı.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }

  // ── Revision revert ────────────────────────────────────────────────────────
  async function revertRevision(revisionId: string) {
    if (!confirm('Bu revizyona geri dönmek istediğinizden emin misiniz? Mevcut taslak üzerine yazılacak.')) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revertToRevision', revisionId }),
      });
      const json = await safeJson<{ record?: BlogAdminRecord; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Geri alma hatası.');
      if (json.record) {
        setRec(json.record);
        setBody(json.record.body ?? '');
        setTitle(json.record.title);
        setExcerpt(json.record.excerpt ?? '');
      }
      setSuccess('Revizyon geri yüklendi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }

  // ── Update tx field ───────────────────────────────────────────────────────
  function updateTxField(locale: string, field: string, value: string) {
    setTxFields(prev => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? { title: '', slug: '', excerpt: '', body: '', metaTitle: '', metaDescription: '', dirty: false }), [field]: value, dirty: true },
    }));
  }

  // Sync txFields when rec changes (e.g. after server save)
  useEffect(() => {
    setTxFields(prev => {
      const next: TxFieldState = { ...prev };
      for (const tx of rec.translations) {
        if (!next[tx.locale] || !next[tx.locale].dirty) {
          next[tx.locale] = {
            title: tx.title ?? '', slug: tx.slug ?? '', excerpt: tx.excerpt ?? '',
            body: tx.body ?? '', metaTitle: tx.metaTitle ?? '', metaDescription: tx.metaDescription ?? '',
            dirty: false,
          };
        }
      }
      return next;
    });
  }, [rec.translations]);

  const currentStatus = rec.status;

  // ── Source status machine buttons ─────────────────────────────────────────
  function SourceStatusButtons() {
    const btns: { label: string; action: string; color: string; bg: string; border?: string }[] = [];

    if (['IDEA','DRAFT','RESEARCH','REVIEW','ARCHIVED'].includes(currentStatus)) {
      if (currentStatus !== 'IDEA') btns.push({ label: '← Fikir', action: 'toIdea', color: '#7C3AED', bg: '#F5F3FF', border: '1px solid #C4B5FD' });
      if (currentStatus !== 'RESEARCH') btns.push({ label: '🔍 Araştırma', action: 'toResearch', color: '#D97706', bg: '#FFFBEB', border: '1px solid #FDE68A' });
      if (currentStatus !== 'DRAFT') btns.push({ label: '📝 Taslak', action: 'toDraft', color: '#6B7280', bg: '#F9FAFB', border: '1px solid #D1D5DB' });
    }
    if (['RESEARCH','DRAFT'].includes(currentStatus)) {
      btns.push({ label: '👁 İncelemeye Gönder', action: 'toReview', color: '#1D4ED8', bg: '#EFF6FF', border: '1px solid #BFDBFE' });
    }
    if (currentStatus === 'REVIEW') {
      btns.push({ label: '✅ Onayla', action: 'toApprove', color: '#0891B2', bg: '#ECFEFF', border: '1px solid #A5F3FC' });
    }
    if (currentStatus === 'APPROVED') {
      btns.push({ label: '🚀 Yayımla', action: 'publishSource', color: '#FFFFFF', bg: '#059669' });
      if (scheduledAt) btns.push({ label: '🕐 Planla', action: 'scheduleSource', color: '#FFFFFF', bg: '#7C3AED' });
    }
    if (currentStatus === 'PUBLISHED') {
      btns.push({ label: '↩ Yayımı Kaldır', action: 'unpublishSource', color: '#374151', bg: '#F3F4F6', border: '1px solid #D1D5DB' });
    }
    if (!['ARCHIVED'].includes(currentStatus)) {
      btns.push({ label: '📦 Arşivle', action: 'archiveSource', color: '#64748B', bg: '#F1F5F9', border: '1px solid #CBD5E1' });
    }
    if (currentStatus === 'ARCHIVED') {
      btns.push({ label: '↩ Taslağa Döndür', action: 'toDraft', color: '#374151', bg: '#F3F4F6', border: '1px solid #D1D5DB' });
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        {btns.map(btn => (
          <button key={btn.action} disabled={saving}
            onClick={() => sourceAction(btn.action, btn.action === 'scheduleSource' && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : undefined)}
            style={{ ...s.btn(btn.color, btn.bg, btn.border), opacity: saving ? 0.6 : 1 }}>
            {btn.label}
          </button>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Global feedback bar ── */}
      {(error || success) && (
        <div style={{ padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, background: error ? '#FEF2F2' : '#ECFDF5', color: error ? '#B91C1C' : '#065F46', border: `1px solid ${error ? '#FECACA' : '#A7F3D0'}` }}>
          {error ?? success}
        </div>
      )}

      {/* ── Autosave indicator ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge status={currentStatus} map={SRC_STATUS} />
          {lastSaved && <span style={{ fontSize: '11px', color: '#94A3B8' }}>Son kayıt: {lastSaved}</span>}
          {saving && <span style={{ fontSize: '11px', color: '#2563EB' }}>Kaydediliyor…</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button disabled={saving} onClick={() => { markDirty(); saveSource({ saveAsDraft: true }); }}
            style={{ ...s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB'), opacity: saving ? 0.6 : 1 }}>
            Taslak Kaydet
          </button>
          <button disabled={saving} onClick={() => { markDirty(); saveSource({ saveAsDraft: false }); }}
            style={{ ...s.btn('#FFFFFF', '#2563EB'), opacity: saving ? 0.6 : 1 }}>
            Kaydet
          </button>
          {(currentStatus === 'DRAFT' || currentStatus === 'APPROVED') && (
            <button disabled={saving} onClick={() => saveSource({ newStatus: 'PUBLISHED' })}
              style={{ ...s.btn('#FFFFFF', '#059669'), opacity: saving ? 0.6 : 1 }}>
              Kaydet & Yayımla
            </button>
          )}
        </div>
      </div>

      {/* ── Locale tab strip ── */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #E2E8F0', marginBottom: '24px', gap: '2px' }}>
        {/* TR source tab */}
        <button onClick={() => setActiveTab('tr')} style={{
          padding: '8px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
          border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          borderBottom: activeTab === 'tr' ? '2px solid #2563EB' : '2px solid transparent',
          color: activeTab === 'tr' ? '#2563EB' : '#64748B',
          background: activeTab === 'tr' ? '#EFF6FF' : 'transparent',
          marginBottom: '-2px', borderRadius: '4px 4px 0 0',
        }}>
          🇹🇷 Türkçe (Kaynak)
        </button>
        {/* Non-TR translation tabs */}
        {LOCALES.map(loc => {
          const tx = rec.translations.find(t => t.locale === loc.code);
          const txStatus = tx?.status ?? 'NOT_STARTED';
          const cfg = TX_STATUS[txStatus] ?? TX_STATUS['NOT_STARTED'];
          return (
            <button key={loc.code} onClick={() => setActiveTab(loc.code)} style={{
              padding: '8px 12px', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
              borderBottom: activeTab === loc.code ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === loc.code ? '#2563EB' : '#64748B',
              background: activeTab === loc.code ? '#EFF6FF' : 'transparent',
              marginBottom: '-2px', borderRadius: '4px 4px 0 0',
            }}>
              {loc.label}
              <span style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, color: cfg.color, background: cfg.bg }}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── TR Source Tab ── */}
      {activeTab === 'tr' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Title + slug */}
            <div style={{ gridColumn: '1/-1' }}>
              <Field label="Başlık *" value={title} onChange={v => { setTitle(v); markDirty(); }} maxLen={300} />
            </div>
            <div>
              <div style={s.fld}>
                <label style={s.lbl}>Slug *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={slug} onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); markDirty(); }}
                    style={{ ...s.inp(), flex: 1 }} />
                  <button onClick={autoSlug} style={s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB')}>Oluştur</button>
                </div>
                <p style={s.hint}>URL&apos;de görünür: /blog/{slug || '…'}</p>
              </div>
            </div>
            <div>
              <div style={s.fld}>
                <label style={s.lbl}>Kategori</label>
                <select value={category} onChange={e => { setCategory(e.target.value); markDirty(); }} style={{ ...s.inp() }}>
                  <option value="">— Seçin —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Field label="Yazar" value={author} onChange={v => { setAuthor(v); markDirty(); }} hint="Belirtilmezse 'VIP Transfer Istanbul' gösterilir." />
            </div>
            <div>
              <div style={s.fld}>
                <label style={s.lbl}>Okuma Süresi (dakika)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" min={1} max={120} value={readTime} onChange={e => { setReadTime(e.target.value ? Number(e.target.value) : ''); markDirty(); }}
                    placeholder={String(autoReadTime)} style={{ ...s.inp(), maxWidth: '100px' }} />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Otomatik: ~{autoReadTime} dk</span>
                  <button onClick={() => { setReadTime(autoReadTime); markDirty(); }} style={s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB')}>Otomatik</button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <TagsInput tags={tags} onChange={v => { setTags(v); markDirty(); }} />
          </div>

          <Field label="Özet (excerpt)" value={excerpt} onChange={v => { setExcerpt(v); markDirty(); }} multiline rows={3} maxLen={500}
            hint="105–155 karakter ideal SEO özeti." />

          {/* Hero image */}
          <div style={s.fld}>
            <label style={s.lbl}>Kapak Görseli</label>
            <ImageUploadField
              value={heroImage}
              onChange={url => { setHeroImage(url); markDirty(); }}
              namespace="blog"
            />
            {heroImage && (
              <button type="button" onClick={() => { setHeroImage(''); markDirty(); }}
                style={{ ...s.btn('#DC2626', '#FEF2F2', '1px solid #FECACA'), fontSize: '11px', marginTop: '4px' }}>
                Görseli Kaldır
              </button>
            )}
          </div>
          <Field label="Kapak Görseli Alt Metni" value={heroImageAlt} onChange={v => { setHeroImageAlt(v); markDirty(); }} maxLen={200} />

          {/* Body */}
          <div style={s.fld}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <label style={{ ...s.lbl, marginBottom: 0 }}>İçerik (Markdown)</label>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                {body.split(/\s+/).filter(Boolean).length} kelime · ~{autoReadTime} dk
              </span>
            </div>
            <textarea value={body} onChange={e => { setBody(e.target.value); markDirty(); }}
              style={{ ...s.ta('ltr', 20), fontFamily: 'ui-monospace, monospace', fontSize: '12px' }} />
            <p style={s.hint}>## H2 başlık, ### H3, **kalın**, [bağlantı](url), - madde</p>
          </div>

          {/* SEO */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>SEO & Open Graph</p>
            <Field label="SEO Başlığı" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty(); }} maxLen={70} />
            <Field label="SEO Açıklaması" value={seoDescription} onChange={v => { setSeoDescription(v); markDirty(); }} multiline rows={2} maxLen={160} />
            <Field label="OG Başlığı" value={ogTitle} onChange={v => { setOgTitle(v); markDirty(); }} maxLen={100} />
            <Field label="OG Açıklaması" value={ogDescription} onChange={v => { setOgDescription(v); markDirty(); }} multiline rows={2} maxLen={200} />
            <div style={s.fld}>
              <label style={s.lbl}>OG Görseli</label>
              <ImageUploadField value={ogImage} onChange={url => { setOgImage(url); markDirty(); }} namespace="blog" />
              {ogImage && (
                <button type="button" onClick={() => { setOgImage(''); markDirty(); }}
                  style={{ ...s.btn('#DC2626', '#FEF2F2', '1px solid #FECACA'), fontSize: '11px', marginTop: '4px' }}>
                  OG Görselini Kaldır
                </button>
              )}
            </div>
            <Field label="Canonical URL" value={canonicalUrl} onChange={v => { setCanonicalUrl(v); markDirty(); }} hint="Boş bırakılırsa otomatik oluşturulur." />
          </div>

          {/* Scheduling */}
          {(currentStatus === 'APPROVED' || currentStatus === 'SCHEDULED') && (
            <div style={s.fld}>
              <label style={s.lbl}>Yayın Tarihi (Planlama)</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => { setScheduledAt(e.target.value); markDirty(); }}
                style={{ ...s.inp(), maxWidth: '260px' }} />
              <p style={s.hint}>Doldurulursa &quot;Planla&quot; düğmesi ile zamanlı yayın yapılır.</p>
            </div>
          )}

          {/* Status machine */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Durum Makinesi</p>
            <SourceStatusButtons />
          </div>

          {/* Revision history */}
          <div style={{ marginBottom: '24px' }}>
            <button onClick={() => setShowRevisions(!showRevisions)}
              style={{ ...s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB'), marginBottom: '8px' }}>
              {showRevisions ? '▲' : '▼'} Revizyon Geçmişi ({rec.revisions.length})
            </button>
            {showRevisions && (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                {rec.revisions.length === 0 ? (
                  <p style={{ padding: '16px', color: '#94A3B8', fontSize: '13px' }}>Henüz revizyon kaydedilmedi.</p>
                ) : rec.revisions.map((rev, i) => (
                  <div key={rev.id} style={{ padding: '12px 16px', borderBottom: i < rec.revisions.length - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', margin: 0 }}>
                        {String((rev.snapshot as Record<string, unknown>).title ?? '(başlık yok)')}
                      </p>
                      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>
                        {new Date(rev.createdAt).toLocaleString('tr-TR')}
                        {(rev.snapshot as Record<string, unknown>).status ? ` · ${String((rev.snapshot as Record<string, unknown>).status)}` : ''}
                      </p>
                    </div>
                    <button onClick={() => revertRevision(rev.id)} disabled={saving}
                      style={{ ...s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB'), fontSize: '11px', opacity: saving ? 0.6 : 1, flexShrink: 0 }}>
                      Geri Yükle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Translation Tabs ── */}
      {activeTab !== 'tr' && (() => {
        const loc   = LOCALES.find(l => l.code === activeTab);
        const tx    = rec.translations.find(t => t.locale === activeTab);
        const txSt  = tx?.status ?? 'NOT_STARTED';
        const fld   = txFields[activeTab] ?? { title: '', slug: '', excerpt: '', body: '', metaTitle: '', metaDescription: '', dirty: false };
        const dir   = loc?.dir ?? 'ltr';

        return (
          <div>
            {/* Status + OUTDATED warning */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge status={txSt} map={TX_STATUS} />
                {tx?.publishedAt && <span style={{ fontSize: '11px', color: '#94A3B8' }}>Yayın: {new Date(tx.publishedAt).toLocaleDateString('tr-TR')}</span>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {fld.dirty && (
                  <button disabled={saving} onClick={() => saveTx(activeTab)}
                    style={{ ...s.btn('#FFFFFF', '#2563EB'), opacity: saving ? 0.6 : 1 }}>
                    Çeviriyi Kaydet
                  </button>
                )}
                <button disabled={saving} onClick={() => txAction(activeTab, 'retranslate')}
                  style={{ ...s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB'), opacity: saving ? 0.6 : 1 }}>
                  🔄 Yeniden Çevir
                </button>
                {['DRAFT','REVIEW'].includes(txSt) && (
                  <button disabled={saving} onClick={() => txAction(activeTab, 'approve')}
                    style={{ ...s.btn('#0891B2', '#ECFEFF', '1px solid #A5F3FC'), opacity: saving ? 0.6 : 1 }}>
                    ✅ Onayla
                  </button>
                )}
                {['DRAFT','REVIEW','APPROVED'].includes(txSt) && (
                  <button disabled={saving} onClick={() => txAction(activeTab, 'publish')}
                    style={{ ...s.btn('#FFFFFF', '#059669'), opacity: saving ? 0.6 : 1 }}>
                    🚀 Yayımla
                  </button>
                )}
                {['PUBLISHED','OUTDATED'].includes(txSt) && (
                  <button disabled={saving} onClick={() => txAction(activeTab, 'unpublish')}
                    style={{ ...s.btn('#374151', '#F3F4F6', '1px solid #D1D5DB'), opacity: saving ? 0.6 : 1 }}>
                    ↩ Yayımı Kaldır
                  </button>
                )}
              </div>
            </div>

            {txSt === 'OUTDATED' && (
              <div style={{ padding: '12px 16px', background: '#FFF7ED', border: '1px solid #FB923C', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#C2410C' }}>
                ⚠️ <strong>TR kaynak güncellendi</strong> — bu çeviri eski içeriği yansıtıyor. Onaylamadan veya yayımlamadan önce &quot;Yeniden Çevir&quot; ile yenileyin.
              </div>
            )}

            {txSt === 'NOT_STARTED' && (
              <div style={{ padding: '12px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#64748B' }}>
                Bu dilde henüz çeviri başlatılmadı. &quot;Yeniden Çevir&quot; ile AI çevirisi başlatılabilir ya da aşağıdaki alanlara manuel çeviri girebilirsiniz.
              </div>
            )}

            <Field label="Başlık" value={fld.title} onChange={v => updateTxField(activeTab, 'title', v)} dir={dir}
              hint={`TR: ${title}`} />
            <Field label="Slug (opsiyonel)" value={fld.slug} onChange={v => updateTxField(activeTab, 'slug', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              hint="Boş bırakılırsa TR slug kullanılır." />
            <Field label="Özet" value={fld.excerpt} onChange={v => updateTxField(activeTab, 'excerpt', v)}
              multiline rows={3} dir={dir} maxLen={500} />
            <div style={s.fld}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ ...s.lbl, marginBottom: 0 }}>İçerik</label>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                  {fld.body.split(/\s+/).filter(Boolean).length} kelime
                </span>
              </div>
              <textarea value={fld.body} onChange={e => updateTxField(activeTab, 'body', e.target.value)} dir={dir}
                style={{ ...s.ta(dir, 16) }} />
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>SEO</p>
              <Field label="SEO Başlığı" value={fld.metaTitle} onChange={v => updateTxField(activeTab, 'metaTitle', v)} dir={dir} maxLen={70} />
              <Field label="SEO Açıklaması" value={fld.metaDescription} onChange={v => updateTxField(activeTab, 'metaDescription', v)} multiline rows={2} dir={dir} maxLen={160} />
            </div>

            {tx?.failureReason && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', color: '#B91C1C' }}>
                Son hata: {tx.failureReason}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
