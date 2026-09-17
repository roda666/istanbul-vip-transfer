'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { BlogAdminRecord } from '@/lib/blog-cms';
import { ImageUploadField } from '@/app/admin/_components/ImageUploadField';
import { AIWriteAssist, type AIWritingField } from '@/app/admin/_components/AIWriteAssist';
import { AISeoGenerator } from '@/app/admin/_components/AISeoGenerator';
import FacebookShareButton from '@/app/admin/_components/FacebookShareButton';
import XShareButton from '@/app/admin/_components/XShareButton';
import LinkedInShareButton from '@/app/admin/_components/LinkedInShareButton';
import TelegramShareButton from '@/app/admin/_components/TelegramShareButton';
import { SITE } from '@/lib/site-config';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';
import { Archive, Check, Eye, FilePlus2, Plus, RefreshCw, Rocket, Save, Trash2, Undo2, X } from 'lucide-react';

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
  'Kurumsal Seyahat', 'Sağlık Turizmi', 'Havalimanı Transferi', 'Havalimanı Rehberi', 'İpuçları',
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

function Field({ label, value, onChange, multiline, rows, dir, hint, maxLen, readOnly, type, aiField }: {
  label: string; value: string; onChange?: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string; maxLen?: number; readOnly?: boolean;
  type?: string; aiField?: AIWritingField;
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
      {aiField && onChange && !readOnly && (
        <AIWriteAssist context="blog" field={aiField} label={label} value={value} onChange={onChange} maxLength={maxLen} />
      )}
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
            <AdminActionButton label="Etiketi kaldır" icon={Trash2} variant="subtle" onClick={() => remove(tag)} className="min-h-11 min-w-11 rounded px-1 py-1 text-xs" />
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Etiket ekle (Enter ile onayla)" style={{ ...s.inp(), flex: 1 }} />
        <AdminActionButton label="Ekle" icon={Plus} variant="new" onClick={add} />
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

type PublishTask = {
  id: string;
  targetLanguageCode: string;
  status: string;
  errorMessage: string | null;
};

type PublishJob = {
  id: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
};

async function concurrentForEach<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

// ── Main BlogEditor ──────────────────────────────────────────────────────────

interface Props { blogId: string; initial: BlogAdminRecord; }

export default function BlogEditor({ blogId, initial }: Props) {
  const router = useRouter();
  // ── Source state ─────────────────────────────────────────────────────────
  const [rec,        setRec]        = useState<BlogAdminRecord>(initial);
  const [activeTab,  setActiveTab]  = useState<'tr' | string>('tr');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [lastSaved,  setLastSaved]  = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishRunning, setPublishRunning] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishTasks, setPublishTasks] = useState<PublishTask[]>([]);

  // Source fields
  const [title,          setTitle]          = useState(initial.title);
  const [slug,           setSlug]           = useState(initial.slug);
  const [excerpt,        setExcerpt]        = useState(initial.excerpt ?? '');
  const [body,           setBody]           = useState(initial.body ?? '');
  const [category,       setCategory]       = useState(initial.category ?? '');
  const [author,         setAuthor]         = useState(initial.author ?? '');
  const [showAuthor,     setShowAuthor]     = useState(initial.showAuthor !== false);
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
  const hasUnsavedRef = useRef(false);

  function markDirty() {
    isDirty.current = true;
    setSourceDirty(true);
  }

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
           showAuthor,
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
      setSourceDirty(false);
      setLastSaved(new Date().toLocaleTimeString('tr-TR'));
      setSuccess(opts.saveAsDraft ? 'Taslak kaydedildi.' : 'Kaydedildi.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata.');
    } finally {
      setSaving(false);
    }
  }, [title, slug, excerpt, body, heroImage, heroImageAlt, ogImage, category, author, showAuthor, tags, readTime, autoReadTime, ogTitle, ogDescription, seoTitle, seoDescription, canonicalUrl, scheduledAt, blogId]);

  const hasDirtyTranslation = Object.values(txFields).some(field => field.dirty);
  const hasUnsavedChanges = sourceDirty || hasDirtyTranslation;
  hasUnsavedRef.current = hasUnsavedChanges;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const popState = () => {
      if (hasUnsavedRef.current && !window.confirm('Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinizden emin misiniz?')) {
        window.history.pushState({ blogEditorGuard: true }, '', window.location.href);
        return;
      }
      window.removeEventListener('popstate', popState);
      window.history.back();
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.history.pushState({ blogEditorGuard: true }, '', window.location.href);
    window.addEventListener('popstate', popState);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', popState);
    };
  }, []);

  // Autosave timer
  useEffect(() => {
    if (!isDirty.current) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      if (isDirty.current) saveSource({ saveAsDraft: rec.status === 'PUBLISHED' });
    }, 30_000);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [title, slug, excerpt, body, category, author, showAuthor, tags, readTime, heroImage, heroImageAlt, seoTitle, seoDescription, ogTitle, ogDescription, saveSource, rec.status]);

  // ── Source status actions ─────────────────────────────────────────────────
  async function sourceAction(action: string, extra?: Record<string, unknown>) {
    if (hasUnsavedRef.current) {
      setError('Durum değiştirmeden önce kaydedilmemiş değişiklikleri kaydedin veya İptal ile vazgeçin.');
      return;
    }
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

  function cancelEditing() {
    if (hasUnsavedRef.current && !window.confirm('Kaydedilmemiş değişiklikler silinecek. Blog listesine dönmek istiyor musunuz?')) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    isDirty.current = false;
    hasUnsavedRef.current = false;
    setSourceDirty(false);
    router.push('/admin/blog');
  }

  async function deleteBlog() {
    if (deleting) return;
    if (hasUnsavedRef.current && !window.confirm('Kaydedilmemiş değişiklikler silme sırasında kaybolacak. Devam edilsin mi?')) return;
    if (!window.confirm('Bu Blog yazısını kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    if (!window.confirm(`"${rec.title}" başlıklı Blog yazısı kalıcı olarak silinecek. Bu işlem geri alınamaz. Silinsin mi?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, { method: 'DELETE' });
      const json = await safeJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Blog yazısı silinemedi.');
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      isDirty.current = false;
      hasUnsavedRef.current = false;
      router.replace('/admin/blog');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Blog yazısı silinemedi.');
      setDeleting(false);
    }
  }

  const refreshPublishJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/admin/api/translations/jobs/${jobId}`);
    const json = await safeJson<{ job?: PublishJob; tasks?: PublishTask[]; error?: string }>(res);
    if (!res.ok || !json.job || !json.tasks) throw new Error(json.error ?? 'Çeviri işi okunamadı.');
    setPublishJob(json.job);
    setPublishTasks(json.tasks);
    return json;
  }, []);

  const processPublishTasks = useCallback(async (jobId: string, tasks: PublishTask[]) => {
    let currentTasks = tasks;
    let finalState: Awaited<ReturnType<typeof refreshPublishJob>> | null = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const runnable = currentTasks.filter(task => ['QUEUED', 'RETRYING'].includes(task.status));
      if (runnable.length === 0) break;
      await concurrentForEach(runnable, 2, async task => {
          setPublishTasks(prev => prev.map(item => item.id === task.id ? { ...item, status: 'RUNNING' } : item));
          const res = await fetch(`/admin/api/translations/jobs/${jobId}/tasks/${task.id}/run`, { method: 'POST' });
          const json = await safeJson<{ status?: string; error?: string }>(res);
          setPublishTasks(prev => prev.map(item => item.id === task.id
            ? { ...item, status: json.status === 'completed' ? 'COMPLETED' : json.status === 'failed' ? 'FAILED' : item.status, errorMessage: json.error ?? null }
            : item));
        });
      finalState = await refreshPublishJob(jobId);
      currentTasks = finalState.tasks ?? [];
    }
    return finalState ?? refreshPublishJob(jobId);
  }, [refreshPublishJob]);

  async function finishPublishRun(jobId: string, tasks: PublishTask[]) {
    const finalState = await processPublishTasks(jobId, tasks);
    if (finalState.job?.status === 'COMPLETED') {
      const recordRes = await fetch(`/admin/api/blog/${blogId}`);
      const recordJson = await safeJson<{ record?: BlogAdminRecord; error?: string }>(recordRes);
      if (!recordRes.ok || !recordJson.record) throw new Error(recordJson.error ?? 'Yayın sonucu okunamadı.');
      setRec(recordJson.record);
      setSuccess('Türkçe ve 8 dil birlikte yayımlandı.');
      setTimeout(() => setSuccess(null), 4000);
    } else {
      const failedLocales = (finalState.tasks ?? [])
        .filter(task => task.status === 'FAILED')
        .map(task => task.targetLanguageCode.toUpperCase());
      setError(`Yayın yapılmadı. Başarısız diller: ${failedLocales.join(', ') || 'bilinmiyor'}.`);
    }
  }

  async function publishAllLanguages() {
    if (publishRunning) return;
    if (hasUnsavedRef.current) {
      setError('8 dilde yayımlamadan önce kaydedilmemiş değişiklikleri kaydedin.');
      return;
    }
    setPublishRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/admin/api/blog/${blogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publishAllLanguages' }),
      });
      const json = await safeJson<{ job?: PublishJob; tasks?: PublishTask[]; error?: string }>(res);
      if (!res.ok || !json.job || !json.tasks) throw new Error(json.error ?? 'Toplu yayın başlatılamadı.');
      setPublishJob(json.job);
      setPublishTasks(json.tasks);
      await finishPublishRun(json.job.id, json.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toplu yayın tamamlanamadı.');
    } finally {
      setPublishRunning(false);
    }
  }

  async function retryFailedPublish() {
    if (!publishJob || publishRunning) return;
    setPublishRunning(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/translations/jobs/${publishJob.id}/retry-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const json = await safeJson<{ tasks?: PublishTask[]; error?: string }>(res);
      if (!res.ok || !json.tasks) throw new Error(json.error ?? 'Başarısız diller yeniden başlatılamadı.');
      setPublishTasks(json.tasks);
      await finishPublishRun(publishJob.id, json.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yeniden deneme tamamlanamadı.');
    } finally {
      setPublishRunning(false);
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
  const publishedBlogUrl = rec.canonicalUrl?.trim() || `${SITE.siteUrl}/blog/${rec.slug}`;
  const shareSummary = rec.seoDescription ?? rec.ogDescription ?? rec.excerpt;

  // ── Source status machine buttons ─────────────────────────────────────────
  function SourceStatusButtons() {
    const btns: { id: string; label: string; action: string }[] = [];
    const add = (action: string, label: string) => btns.push({ id: `${currentStatus}:${action}`, action, label });

    if (currentStatus !== 'ARCHIVED') add('archiveSource', 'Arşivle');

    return (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {btns.map(btn => (
          <AdminActionButton
            key={btn.id}
            label={btn.label}
            icon={Archive}
            variant="archive"
            disabled={saving || publishRunning || hasUnsavedChanges}
            onClick={() => { void sourceAction(btn.action, btn.action === 'scheduleSource' && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : undefined); }}
          />
        ))}
        {['DRAFT', 'REVIEW', 'APPROVED'].includes(currentStatus) && (
          <AdminActionButton
            label="8 Dile Çevir ve Yayınla"
            icon={Rocket}
            variant="activate"
            loading={publishRunning}
            disabled={saving || hasUnsavedChanges}
            onClick={() => void publishAllLanguages()}
          />
        )}
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
      <div data-testid="blog-top-status" style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge status={currentStatus} map={SRC_STATUS} />
          {rec.hasPendingDraft && (
            <span style={{ padding: '3px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, color: '#C2410C', background: '#FFF7ED' }}>
              Bekleyen taslak
            </span>
          )}
          {lastSaved && <span style={{ fontSize: '11px', color: '#94A3B8' }}>Son kayıt: {lastSaved}</span>}
          {saving && <span style={{ fontSize: '11px', color: '#2563EB' }}>Kaydediliyor…</span>}
        </div>
      </div>

      {publishTasks.length > 0 && (
        <div style={{ padding: '14px 16px', border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: '8px', marginBottom: '16px' }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p style={{ margin: 0, color: '#1E3A8A', fontSize: '13px', fontWeight: 700 }}>
                8 dilde atomik yayın
              </p>
              <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '12px' }}>
                {publishTasks.filter(task => task.status === 'COMPLETED').length} / 8 dil tamamlandı
                {publishJob ? ` · ${publishJob.status}` : ''}
              </p>
            </div>
            {!publishRunning && publishTasks.some(task => task.status === 'FAILED') && (
              <AdminActionButton label="Başarısız Dilleri Yeniden Dene" icon={RefreshCw} variant="subtle" onClick={() => void retryFailedPublish()} />
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {publishTasks.map(task => (
              <div key={task.id} title={task.errorMessage ?? undefined} style={{
                minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                color: task.status === 'FAILED' ? '#991B1B' : task.status === 'COMPLETED' ? '#065F46' : '#1D4ED8',
                background: task.status === 'FAILED' ? '#FEF2F2' : task.status === 'COMPLETED' ? '#ECFDF5' : '#FFFFFF',
                border: `1px solid ${task.status === 'FAILED' ? '#FECACA' : task.status === 'COMPLETED' ? '#A7F3D0' : '#BFDBFE'}`,
              }}>
                {task.targetLanguageCode.toUpperCase()} · {task.status === 'COMPLETED' ? 'Hazır' : task.status === 'FAILED' ? 'Hata' : 'İşleniyor'}
              </div>
            ))}
          </div>
        </div>
      )}

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
              <Field label="Başlık *" value={title} onChange={v => { setTitle(v); markDirty(); }} maxLen={300} aiField="title" />
            </div>
            <div>
              <div style={s.fld}>
                <label style={s.lbl}>Slug *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={slug} onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); markDirty(); }}
                    style={{ ...s.inp(), flex: 1 }} />
                  <AdminActionButton label="Oluştur" icon={FilePlus2} variant="subtle" onClick={autoSlug} />
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-8px', marginBottom: '16px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAuthor}
                  onChange={e => { setShowAuthor(e.target.checked); markDirty(); }}
                />
                Yazarı göster
              </label>
            </div>
            <div>
              <div style={s.fld}>
                <label style={s.lbl}>Okuma Süresi (dakika)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" min={1} max={120} value={readTime} onChange={e => { setReadTime(e.target.value ? Number(e.target.value) : ''); markDirty(); }}
                    placeholder={String(autoReadTime)} style={{ ...s.inp(), maxWidth: '100px' }} />
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>Otomatik: ~{autoReadTime} dk</span>
                  <AdminActionButton label="Otomatik" icon={RefreshCw} variant="subtle" onClick={() => { setReadTime(autoReadTime); markDirty(); }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <TagsInput tags={tags} onChange={v => { setTags(v); markDirty(); }} />
          </div>

          <Field label="Özet (excerpt)" value={excerpt} onChange={v => { setExcerpt(v); markDirty(); }} multiline rows={3} maxLen={500} aiField="description"
            hint="105–155 karakter ideal SEO özeti." />

          {/* Hero image */}
          <div style={s.fld}>
            <label style={s.lbl}>Kapak Görseli</label>
            <ImageUploadField
              value={heroImage}
              onChange={url => { setHeroImage(url); markDirty(); }}
              namespace="blog"
              ai={{ target: 'BLOG_POST', id: blogId, placement: 'hero', imageField: 'hero_image', promptHint: 'Makale kapak görselini açıklayın…' }}
            />
            {heroImage && (
                <AdminActionButton type="button" label="Görseli Kaldır" icon={Trash2} variant="delete" className="mt-1 text-xs" onClick={() => { setHeroImage(''); markDirty(); }} />
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
            <p style={s.hint}>## H2, ### H3, **kalın**, [bağlantı](url), - madde, ![alt metin](/gorsel.jpg). Tablo: | Başlık | Değer | ardından | --- | --- | satırı.</p>
            <AIWriteAssist context="blog" field="body" label="İçerik (Markdown)" value={body} onChange={v => { setBody(v); markDirty(); }} maxLength={12_000} />
            <ImageUploadField
              label="İçerik İçi AI Görseli"
              value=""
              onChange={url => { setBody(current => `${current}\n\n![İçerik görseli](${url})\n`); markDirty(); }}
              namespace="blog"
              ai={{ target: 'BLOG_POST', id: blogId, placement: 'body', imageField: 'body', promptHint: 'Makale içinde kullanılacak görseli açıklayın…' }}
            />
          </div>

          {/* SEO */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>SEO & Open Graph</p>
            <AISeoGenerator context="blog" title={seoTitle} description={seoDescription}
              onTitleChange={v => { setSeoTitle(v); markDirty(); }}
              onDescriptionChange={v => { setSeoDescription(v); markDirty(); }} />
            <Field label="SEO Başlığı" value={seoTitle} onChange={v => { setSeoTitle(v); markDirty(); }} maxLen={70} aiField="seo_title" />
            <Field label="SEO Açıklaması" value={seoDescription} onChange={v => { setSeoDescription(v); markDirty(); }} multiline rows={2} maxLen={160} aiField="seo_description" />
            <Field label="OG Başlığı" value={ogTitle} onChange={v => { setOgTitle(v); markDirty(); }} maxLen={100} aiField="seo_title" />
            <Field label="OG Açıklaması" value={ogDescription} onChange={v => { setOgDescription(v); markDirty(); }} multiline rows={2} maxLen={200} aiField="seo_description" />
            <div style={s.fld}>
              <label style={s.lbl}>OG Görseli</label>
              <ImageUploadField value={ogImage} onChange={url => { setOgImage(url); markDirty(); }} namespace="blog"
                ai={{ target: 'BLOG_POST', id: blogId, placement: 'og', imageField: 'og_image', promptHint: 'Sosyal paylaşım görselini açıklayın…' }} />
              {ogImage && (
                <AdminActionButton type="button" label="OG Görselini Kaldır" icon={Trash2} variant="delete" className="mt-1 text-xs" onClick={() => { setOgImage(''); markDirty(); }} />
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
            <AdminActionButton label={`${showRevisions ? 'Gizle' : 'Göster'}: Revizyon Geçmişi (${rec.revisions.length})`} icon={Undo2} variant="subtle" className="mb-2" onClick={() => setShowRevisions(!showRevisions)} />
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
                    <AdminActionButton label="Geri Yükle" icon={Undo2} variant="subtle" className="shrink-0 text-xs" onClick={() => void revertRevision(rev.id)} disabled={saving} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-testid="blog-bottom-actions" className="grid w-full grid-cols-1 gap-2 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <FacebookShareButton url={publishedBlogUrl} label="Bu yazıyı Facebook'ta paylaş" disabled={currentStatus !== 'PUBLISHED'} />
            <XShareButton title={rec.title} summary={shareSummary} url={publishedBlogUrl} label="Bu yazıyı X'te paylaş" disabled={currentStatus !== 'PUBLISHED'} />
            <LinkedInShareButton url={publishedBlogUrl} label="Bu yazıyı LinkedIn'de paylaş" disabled={currentStatus !== 'PUBLISHED'} />
            <TelegramShareButton title={rec.title} url={publishedBlogUrl} label="Bu yazıyı Telegram'da paylaş" disabled={currentStatus !== 'PUBLISHED'} />
            <AdminActionButton label="Taslak Kaydet" icon={FilePlus2} variant="save" disabled={saving} onClick={() => { markDirty(); void saveSource({ saveAsDraft: true }); }} />
            <AdminActionButton label="İptal" icon={X} variant="cancel" manage={false} disabled={saving || publishRunning || deleting} onClick={cancelEditing} />
            <AdminActionButton label="Sil" icon={Trash2} variant="delete" loading={deleting} disabled={saving || publishRunning} onClick={() => void deleteBlog()} />
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
                  <AdminActionButton label="Çeviriyi Kaydet" icon={Save} variant="save" disabled={saving} onClick={() => void saveTx(activeTab)} />
                )}
                <AdminActionButton label="Yeniden Çevir" icon={RefreshCw} variant="subtle" disabled={saving} onClick={() => void txAction(activeTab, 'retranslate')} />
                {['DRAFT','REVIEW'].includes(txSt) && (
                  <AdminActionButton label="Onayla" icon={Check} variant="activate" disabled={saving} onClick={() => void txAction(activeTab, 'approve')} />
                )}
                {['DRAFT','REVIEW','APPROVED'].includes(txSt) && (
                  <AdminActionButton label="Yayımla" icon={Rocket} variant="activate" disabled={saving} onClick={() => void txAction(activeTab, 'publish')} />
                )}
                {['PUBLISHED','OUTDATED'].includes(txSt) && (
                  <AdminActionButton label="Yayımı Kaldır" icon={X} variant="deactivate" disabled={saving} onClick={() => void txAction(activeTab, 'unpublish')} />
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
              <p style={s.hint}>Markdown kullanın: ![alt metin](https://...), tablo için | Başlık | Değer | ve alt satırda | --- | --- |.</p>
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
