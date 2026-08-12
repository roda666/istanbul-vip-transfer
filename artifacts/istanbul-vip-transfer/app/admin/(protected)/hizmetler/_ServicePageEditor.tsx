'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { ServicePageRecord, ServicePageBody, ServicePageTranslation } from '@/lib/service-page-types';

// ── Image upload widget ────────────────────────────────────────────────────

function ImageUploadField({
  label,
  value,
  onChange,
  slug,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  slug: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      // Step 1: get presigned URL from admin route
      const metaRes = await fetch('/admin/api/storage/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'image/jpeg',
          slug,
        }),
      });
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({ error: 'Sunucu hatası' }));
        throw new Error(err.error ?? 'Yükleme URL alınamadı');
      }
      const { uploadURL, serveUrl, contentType } = await metaRes.json();

      // Step 2: PUT file directly to GCS presigned URL
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType || file.type || 'image/jpeg' },
      });
      if (!putRes.ok) throw new Error('Depolamaya yükleme başarısız');

      // Step 3: auto-fill the path field
      onChange(serveUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <input
          style={{ ...inp(), flex: 1 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Örn: /images/hero.webp veya /api/storage/objects/…"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            border: '1px solid #D1D5DB',
            background: uploading ? '#F1F5F9' : '#F8FAFC',
            color: '#374151',
            borderRadius: '6px',
            padding: '0 14px',
            cursor: uploading ? 'default' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {uploading ? '⏳ Yükleniyor…' : '⬆ Görsel Yükle'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
      {hint && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>{hint}</p>}
      {uploadError && (
        <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>
          Hata: {uploadError}
        </p>
      )}
      {/* Preview thumbnail if value looks like an image URL */}
      {value && (value.startsWith('/') || value.startsWith('http')) && (
        <div style={{ marginTop: '8px', width: '160px', height: '90px', position: 'relative', borderRadius: '6px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <Image
            src={value}
            alt="Önizleme"
            fill
            sizes="160px"
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}

// ── Safe JSON fetch helper ─────────────────────────────────────────────────
async function safeJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const ct = res.headers.get('content-type') ?? '';
  if (!text.trim()) throw new Error(`Sunucu boş yanıt döndürdü (HTTP ${res.status}).`);
  if (!ct.includes('json')) throw new Error(`Beklenmeyen yanıt (HTTP ${res.status}): ${text.slice(0, 120)}`);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`JSON hatası (HTTP ${res.status}): ${text.slice(0, 120)}`); }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface EditorLocale {
  code: string;
  label: string;
  dir: 'ltr' | 'rtl';
}

const ALL_LOCALES: EditorLocale[] = [
  { code: 'tr', label: 'Türkçe',   dir: 'ltr' },
  { code: 'en', label: 'English',  dir: 'ltr' },
  { code: 'de', label: 'Deutsch',  dir: 'ltr' },
  { code: 'ru', label: 'Русский',  dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

// ── Status badge config ────────────────────────────────────────────────────

const TX_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  NOT_STARTED:  { label: 'Başlamadı',       color: '#94A3B8', bg: '#F8FAFC' },
  QUEUED:       { label: 'Çeviri bekliyor', color: '#D97706', bg: '#FFFBEB' },
  TRANSLATING:  { label: 'Çevriliyor…',     color: '#2563EB', bg: '#EFF6FF' },
  DRAFT:        { label: 'Taslak',          color: '#9333EA', bg: '#FAF5FF' },
  REVIEW:       { label: 'İnceleniyor',     color: '#9333EA', bg: '#FAF5FF' },
  APPROVED:     { label: 'Onaylandı',       color: '#0891B2', bg: '#ECFEFF' },
  PUBLISHED:    { label: 'Yayında',         color: '#059669', bg: '#ECFDF5' },
  FAILED:       { label: 'Hata',            color: '#DC2626', bg: '#FEF2F2' },
  ARCHIVED:     { label: 'Arşiv',           color: '#64748B', bg: '#F1F5F9' },
};

// ── Styles ─────────────────────────────────────────────────────────────────

const inp = (dir?: string): React.CSSProperties => ({
  width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
  borderRadius: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
  color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box',
  direction: dir as React.CSSProperties['direction'],
});
const ta = (dir?: string, rows = 3): React.CSSProperties => ({
  ...inp(dir), resize: 'vertical', minHeight: `${rows * 22 + 16}px`,
});
const lbl: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: '#374151',
  fontFamily: 'Inter, sans-serif', marginBottom: '4px', display: 'block',
};

// ── Reusable field components ───────────────────────────────────────────────

function Field({ name, value, onChange, multiline, rows, dir, hint, readOnly }: {
  name: string; value: string; onChange?: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={lbl}>{name}</label>
      {multiline
        ? <textarea style={{ ...ta(dir, rows), opacity: readOnly ? 0.6 : 1 }} value={value}
            onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
        : <input style={{ ...inp(dir), opacity: readOnly ? 0.6 : 1 }} value={value}
            onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
      }
      {hint && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>{hint}</p>}
    </div>
  );
}

function Checkbox({ name, checked, onChange }: { name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
      marginBottom: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: '16px', height: '16px' }} />
      {name}
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
      marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', fontFamily: 'Inter, sans-serif' }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = TX_STATUS[status] ?? TX_STATUS.NOT_STARTED;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
      color: s.color, background: s.bg, fontFamily: 'Inter, sans-serif' }}>
      {s.label}
    </span>
  );
}

// ── Features list editor ────────────────────────────────────────────────────

function FeaturesEditor({ features, onChange, dir, readOnly }: {
  features: string[]; onChange: (f: string[]) => void; dir: string; readOnly?: boolean;
}) {
  const add = () => onChange([...features, '']);
  const remove = (i: number) => onChange(features.filter((_, idx) => idx !== i));
  const set = (i: number, v: string) => { const f = [...features]; f[i] = v; onChange(f); };

  return (
    <div>
      {features.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <input style={{ ...inp(dir), flex: 1, opacity: readOnly ? 0.6 : 1 }}
            value={f} onChange={e => set(i, e.target.value)} dir={dir} readOnly={readOnly} />
          {!readOnly && (
            <button onClick={() => remove(i)} style={{ border: 'none', background: '#FEE2E2',
              color: '#DC2626', borderRadius: '6px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}>
              ✕
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button onClick={add} style={{ border: '1px dashed #D1D5DB', background: 'transparent',
          color: '#6B7280', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer',
          fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
          + Özellik Ekle
        </button>
      )}
    </div>
  );
}

// ── Translation locale panel ────────────────────────────────────────────────

function TranslationPanel({
  tx, locale, dir,
  onAction,
}: {
  tx: ServicePageTranslation | undefined;
  locale: string;
  dir: 'ltr' | 'rtl';
  contentId: string;
  onAction: (locale: string, action: string) => Promise<void>;
}) {
  const status = tx?.status ?? 'NOT_STARTED';
  const body = tx?.body;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const doAction = async (action: string) => {
    setActionLoading(action);
    try { await onAction(locale, action); }
    finally { setActionLoading(null); }
  };

  const canApprove  = ['DRAFT', 'REVIEW', 'FAILED'].includes(status);
  const canPublish  = ['APPROVED', 'DRAFT', 'REVIEW'].includes(status);
  const canUnpublish = status === 'PUBLISHED';

  const btnStyle = (color: string, bg: string): React.CSSProperties => ({
    border: 'none', background: bg, color, borderRadius: '6px', padding: '6px 14px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
    opacity: actionLoading ? 0.5 : 1,
  });

  return (
    <div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <StatusBadge status={status} />
        <button onClick={() => doAction('translate')} style={btnStyle('#1E293B', '#E2E8F0')}
          disabled={!!actionLoading}>
          {actionLoading === 'translate' ? 'Çevriliyor…' : '↺ Yeniden Çevir'}
        </button>
        {canApprove && (
          <button onClick={() => doAction('approve')} style={btnStyle('#FFFFFF', '#0891B2')}
            disabled={!!actionLoading}>
            {actionLoading === 'approve' ? '…' : '✓ Onayla'}
          </button>
        )}
        {canPublish && (
          <button onClick={() => doAction('publish')} style={btnStyle('#FFFFFF', '#059669')}
            disabled={!!actionLoading}>
            {actionLoading === 'publish' ? '…' : '▶ Yayımla'}
          </button>
        )}
        {canUnpublish && (
          <button onClick={() => doAction('unpublish')} style={btnStyle('#92400E', '#FEF3C7')}
            disabled={!!actionLoading}>
            {actionLoading === 'unpublish' ? '…' : '⏸ Yayından Al'}
          </button>
        )}
      </div>

      {tx?.failureReason && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#B91C1C',
          fontFamily: 'Inter, sans-serif' }}>
          Hata: {tx.failureReason}
        </div>
      )}

      {/* Translated content preview */}
      {body && (
        <>
          <SectionCard title="Hero">
            <Field name="Badge" value={body.hero.badge} dir={dir} readOnly />
            <Field name="Başlık" value={body.hero.title} dir={dir} readOnly />
            <Field name="Alt Başlık" value={body.hero.subtitle} multiline rows={3} dir={dir} readOnly />
            <Field name="Breadcrumb" value={body.hero.crumb} dir={dir} readOnly />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field name="CTA Birincil" value={body.hero.ctaPrimary} dir={dir} readOnly />
              <Field name="CTA İkincil" value={body.hero.ctaSecondary} dir={dir} readOnly />
            </div>
          </SectionCard>
          <SectionCard title="Özellikler">
            <FeaturesEditor features={body.features} onChange={() => {}} dir={dir} readOnly />
          </SectionCard>
          <SectionCard title="SEO / OG">
            <Field name="OG Başlık" value={body.seo.ogTitle} dir={dir} readOnly />
            <Field name="OG Açıklama" value={body.seo.ogDescription} multiline dir={dir} readOnly />
          </SectionCard>
          {tx?.metaTitle && <Field name="Meta Başlık" value={tx.metaTitle} dir={dir} readOnly />}
          {tx?.metaDescription && <Field name="Meta Açıklama" value={tx.metaDescription} multiline dir={dir} readOnly />}
        </>
      )}

      {!body && status !== 'NOT_STARTED' && status !== 'TRANSLATING' && (
        <p style={{ fontSize: '13px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
          Çeviri içeriği henüz oluşturulmadı.
        </p>
      )}
      {status === 'NOT_STARTED' && (
        <p style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          TR kaynak kaydedildiğinde otomatik çeviri başlar.
        </p>
      )}
      {status === 'TRANSLATING' && (
        <p style={{ fontSize: '13px', color: '#2563EB', fontFamily: 'Inter, sans-serif' }}>
          Çeviri yapılıyor…
        </p>
      )}
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────

interface Props {
  initialRecord: ServicePageRecord;
}

export default function ServicePageEditor({ initialRecord }: Props) {
  const [record, setRecord]       = useState<ServicePageRecord>(initialRecord);
  const [activeLocale, setActiveLocale] = useState('tr');
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TR editable state
  const [title, setTitle]       = useState(record.title);
  const [excerpt, setExcerpt]   = useState(record.excerpt ?? '');
  const [isActive, setIsActive] = useState(record.isActive);
  const [indexable, setIndexable] = useState(record.indexable);
  const [displayOrder, setDisplayOrder] = useState(record.displayOrder);
  const [seoTitle, setSeoTitle]   = useState(record.seoTitle ?? '');
  const [seoDesc, setSeoDesc]     = useState(record.seoDescription ?? '');
  const [heroImage, setHeroImage] = useState(record.heroImage ?? '');
  const [heroImageAlt, setHeroImageAlt] = useState(record.heroImageAlt ?? '');
  const [ogImage, setOgImage]     = useState(record.ogImage ?? '');

  const [body, setBody] = useState<ServicePageBody>(
    record.body ?? {
      version: 1,
      hero: { badge: '', title: '', subtitle: '', crumb: '', ctaPrimary: 'Fiyat Al / Rezervasyon', ctaSecondary: 'Hemen Ara' },
      features: [],
      seo: { ogTitle: '', ogDescription: '' },
    },
  );

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const setHero = (key: keyof ServicePageBody['hero'], val: string) => {
    setBody(b => ({ ...b, hero: { ...b.hero, [key]: val } }));
  };
  const setSeo = (key: keyof ServicePageBody['seo'], val: string) => {
    setBody(b => ({ ...b, seo: { ...b.seo, [key]: val } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/admin/api/service-pages/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, excerpt: excerpt || null, body,
          seoTitle: seoTitle || null, seoDescription: seoDesc || null,
          heroImage: heroImage || null, heroImageAlt: heroImageAlt || null,
          ogImage: ogImage || null,
          indexable, isActive, displayOrder,
          autoTranslate: true,
        }),
      });
      const data = await safeJson<{ record?: ServicePageRecord; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Kaydetme hatası.');
      if (data.record) setRecord(data.record);
      showToast('success', 'Kaydedildi. Çeviri taslakları oluşturuluyor…');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    } finally {
      setSaving(false);
    }
  };

  const handleTranslationAction = useCallback(async (locale: string, action: string) => {
    const res = await fetch(`/admin/api/service-pages/${record.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, locale }),
    });
    const data = await safeJson<{ record?: ServicePageRecord; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? 'Eylem başarısız.');
    if (data.record) setRecord(data.record);
    showToast('success', 'İşlem tamamlandı.');
  }, [record.id, showToast]);

  const currentTx = record.translations.find(t => t.locale === activeLocale);
  const currentLocale = ALL_LOCALES.find(l => l.code === activeLocale) ?? ALL_LOCALES[0];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: toast.type === 'success' ? '#065F46' : '#B91C1C',
          border: `1px solid ${toast.type === 'success' ? '#6EE7B7' : '#FECACA'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '360px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>/{record.slug}</p>
          <StatusBadge status={record.status} />
        </div>
        {activeLocale === 'tr' && (
          <button onClick={handleSave} disabled={saving} style={{
            background: '#C9A84C', color: '#0A0A0A', border: 'none', borderRadius: '8px',
            padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Kaydediliyor…' : '✓ Kaydet ve Çevir'}
          </button>
        )}
      </div>

      {/* Locale tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {ALL_LOCALES.map(loc => {
          const tx = record.translations.find(t => t.locale === loc.code);
          const status = loc.code === 'tr' ? record.status : (tx?.status ?? 'NOT_STARTED');
          const s = TX_STATUS[status] ?? TX_STATUS.NOT_STARTED;
          const isActive = activeLocale === loc.code;
          return (
            <button key={loc.code} onClick={() => setActiveLocale(loc.code)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: isActive ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
              background: isActive ? '#1E293B' : '#F1F5F9',
              color: isActive ? '#FFFFFF' : '#374151',
              border: `1px solid ${isActive ? '#1E293B' : '#E2E8F0'}`,
            }}>
              {loc.label}
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* TR editor pane */}
      {activeLocale === 'tr' && (
        <>
          <SectionCard title="Temel Bilgiler">
            <Field name="Sayfa Başlığı (Admin)" value={title} onChange={setTitle} />
            <Field name="Kısa Açıklama (Excerpt)" value={excerpt} onChange={setExcerpt} multiline rows={3} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Sıra</label>
                <input type="number" value={displayOrder} onChange={e => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  style={{ ...inp(), width: '100px' }} />
              </div>
              <div style={{ paddingTop: '20px' }}>
                <Checkbox name="Aktif (yayında göster)" checked={isActive} onChange={setIsActive} />
                <Checkbox name="Arama motorlarında dizinle" checked={indexable} onChange={setIndexable} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Hero Bölümü">
            <Field name="Badge / Rozet" value={body.hero.badge} onChange={v => setHero('badge', v)} />
            <Field name="Başlık (H1)" value={body.hero.title} onChange={v => setHero('title', v)} />
            <Field name="Alt Başlık" value={body.hero.subtitle} onChange={v => setHero('subtitle', v)} multiline rows={3} />
            <Field name="Breadcrumb Etiketi" value={body.hero.crumb} onChange={v => setHero('crumb', v)}
              hint="Navigasyonda görünecek kısa etiket" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field name="CTA Birincil" value={body.hero.ctaPrimary} onChange={v => setHero('ctaPrimary', v)} />
              <Field name="CTA İkincil" value={body.hero.ctaSecondary} onChange={v => setHero('ctaSecondary', v)} />
            </div>
          </SectionCard>

          <SectionCard title="Özellikler Listesi">
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
              Sayfada gösterilecek servis özelliklerini girin.
            </p>
            <FeaturesEditor features={body.features} onChange={f => setBody(b => ({ ...b, features: f }))} dir="ltr" />
          </SectionCard>

          <SectionCard title="Görseller">
            <ImageUploadField
              label="Hero Görseli"
              value={heroImage}
              onChange={setHeroImage}
              slug={record.slug}
              hint="Sürükle-bırak veya bilgisayardan seçin — yüklemeden sonra yol otomatik doldurulur. Doğrudan yol da girebilirsiniz."
            />
            <Field name="Hero Görseli ALT Metni" value={heroImageAlt} onChange={setHeroImageAlt} />
            <ImageUploadField
              label="OG / Sosyal Medya Görseli"
              value={ogImage}
              onChange={setOgImage}
              slug={record.slug}
              hint="Paylaşımlarda görünen görsel (1200×630 önerilir). Yüklemeden sonra yol otomatik doldurulur."
            />
          </SectionCard>

          <SectionCard title="SEO">
            <Field name="OG Başlık (Sosyal Paylaşım)" value={body.seo.ogTitle} onChange={v => setSeo('ogTitle', v)} />
            <Field name="OG Açıklama" value={body.seo.ogDescription} onChange={v => setSeo('ogDescription', v)} multiline rows={3} />
            <Field name="Meta Başlık (Browser Tab)" value={seoTitle} onChange={setSeoTitle} />
            <Field name="Meta Açıklama" value={seoDesc} onChange={setSeoDesc} multiline rows={3} />
          </SectionCard>
        </>
      )}

      {/* Translation locale pane */}
      {activeLocale !== 'tr' && (
        <TranslationPanel
          tx={currentTx}
          locale={activeLocale}
          dir={currentLocale.dir}
          contentId={record.id}
          onAction={handleTranslationAction}
        />
      )}
    </div>
  );
}
