'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ServicePageRecord,
  ServicePageBody,
  ServicePageTranslation,
  ServicePageContentSection,
  ServicePageFaq,
  ServicePageServiceArea,
} from '@/lib/service-page-types';
import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';
import { ImageUploadField } from '@/app/admin/_components/ImageUploadField';
import { AIWriteAssist, type AIWritingField } from '@/app/admin/_components/AIWriteAssist';
import FacebookShareButton from '@/app/admin/_components/FacebookShareButton';
import XShareButton from '@/app/admin/_components/XShareButton';
import { SITE } from '@/lib/site-config';

// ── Safe JSON fetch ────────────────────────────────────────────────────────
async function safeJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const ct   = res.headers.get('content-type') ?? '';
  if (!text.trim()) throw new Error(`Sunucu boş yanıt döndürdü (HTTP ${res.status}).`);
  if (!ct.includes('json')) throw new Error(`Beklenmeyen yanıt (HTTP ${res.status}): ${text.slice(0, 120)}`);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`JSON hatası (HTTP ${res.status}): ${text.slice(0, 120)}`); }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface EditorLocale { code: string; label: string; dir: 'ltr' | 'rtl' }

const ALL_LOCALES: EditorLocale[] = LOCALE_REGISTRY.map(l => ({
  code:  l.code,
  label: `${l.flagEmoji} ${l.nativeName}`,
  dir:   l.dir,
}));

// ── Status configs ─────────────────────────────────────────────────────────

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
  OUTDATED:     { label: 'Güncelleme Gerekli', color: '#EA580C', bg: '#FFF7ED' },
};

// CATEGORY_OPTIONS is now fetched dynamically from /admin/api/categories

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
const btnPrimary: React.CSSProperties = {
  background: '#C9A84C', color: '#0A0A0A', border: 'none', borderRadius: '8px',
  padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: '#F1F5F9', color: '#374151', border: '1px solid #D1D5DB',
  borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};

// ── Reusable field components ───────────────────────────────────────────────

function Field({ name, value, onChange, multiline, rows, dir, hint, readOnly, maxLen, aiField }: {
  name: string; value: string; onChange?: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string; readOnly?: boolean;
  /** When set, shows a live character count badge and a red border when exceeded. */
  maxLen?: number; aiField?: AIWritingField;
}) {
  const over = maxLen !== undefined && value.length > maxLen;
  const near = maxLen !== undefined && !over && value.length > Math.floor(maxLen * 0.85);
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <label style={{ ...lbl, marginBottom: 0 }}>{name}</label>
        {maxLen !== undefined && (
          <span style={{
            fontSize: '11px', fontFamily: 'Inter, sans-serif', flexShrink: 0, marginLeft: '8px',
            color: over ? '#DC2626' : near ? '#D97706' : '#94A3B8',
            fontWeight: over ? 700 : 400,
          }}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      {multiline
        ? <textarea style={{ ...ta(dir, rows), opacity: readOnly ? 0.6 : 1, borderColor: over ? '#EF4444' : undefined }} value={value}
            onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
        : <input style={{ ...inp(dir), opacity: readOnly ? 0.6 : 1, borderColor: over ? '#EF4444' : undefined }} value={value}
            onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
      }
      {hint && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>{hint}</p>}
      {aiField && onChange && !readOnly && (
        <AIWriteAssist context="service" field={aiField} label={name} value={value} onChange={onChange} maxLength={maxLen} />
      )}
    </div>
  );
}

function Checkbox({ name, checked, onChange, hint }: { name: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
        fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: '16px', height: '16px', flexShrink: 0 }} />
        {name}
      </label>
      {hint && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', marginLeft: '24px', fontFamily: 'Inter, sans-serif' }}>{hint}</p>}
    </div>
  );
}

function SectionCard({ title, children, collapsible, defaultOpen }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', marginBottom: '20px', overflow: 'hidden' }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          padding: '12px 20px', borderBottom: open ? '1px solid #E2E8F0' : 'none',
          background: '#F8FAFC', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', fontFamily: 'Inter, sans-serif' }}>{title}</span>
        {collapsible && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{open ? '▲ Gizle' : '▼ Göster'}</span>}
      </div>
      {open && <div style={{ padding: '20px' }}>{children}</div>}
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
  const add    = () => onChange([...features, '']);
  const remove = (i: number) => onChange(features.filter((_, idx) => idx !== i));
  const set    = (i: number, v: string) => { const f = [...features]; f[i] = v; onChange(f); };
  return (
    <div>
      {features.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <input style={{ ...inp(dir), flex: 1, opacity: readOnly ? 0.6 : 1 }}
            value={f} onChange={e => set(i, e.target.value)} dir={dir} readOnly={readOnly} />
          {!readOnly && (
            <button onClick={() => remove(i)} style={{ border: 'none', background: '#FEE2E2', color: '#DC2626',
              borderRadius: '6px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
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

// ── Content sections editor ────────────────────────────────────────────────

function ContentSectionsEditor({ sections, onChange, dir, readOnly }: {
  sections: ServicePageContentSection[];
  onChange: (s: ServicePageContentSection[]) => void;
  dir: string; readOnly?: boolean;
}) {
  const add = () => onChange([...sections, {
    id: crypto.randomUUID(), headingLevel: 'h2', heading: '', body: '',
  }]);
  const remove = (id: string) => onChange(sections.filter(s => s.id !== id));
  const update = (id: string, key: keyof ServicePageContentSection, value: string) =>
    onChange(sections.map(s => s.id === id ? { ...s, [key]: value } : s));

  return (
    <div>
      {sections.length === 0 && !readOnly && (
        <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
          Henüz içerik bölümü yok. Aşağıdan ekleyin.
        </p>
      )}
      {sections.map((s, i) => (
        <div key={s.id} style={{
          border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px',
          marginBottom: '12px', background: '#FAFAFA',
        }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Başlık Seviyesi</label>
              <select
                value={s.headingLevel}
                onChange={e => !readOnly && update(s.id, 'headingLevel', e.target.value)}
                disabled={readOnly}
                style={{ ...inp(), width: '120px' }}
              >
                <option value="h2">H2</option>
                <option value="h3">H3</option>
              </select>
            </div>
            {!readOnly && (
              <button onClick={() => remove(s.id)} style={{ border: 'none', background: '#FEE2E2',
                color: '#DC2626', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '20px' }}>
                Sil
              </button>
            )}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Bölüm {i + 1} Başlığı ({s.headingLevel.toUpperCase()})</label>
            <input style={{ ...inp(dir), opacity: readOnly ? 0.6 : 1 }}
              value={s.heading} onChange={e => !readOnly && update(s.id, 'heading', e.target.value)}
              dir={dir} readOnly={readOnly} placeholder="Bölüm başlığını girin…" />
             {!readOnly && <AIWriteAssist context="service" field="title" label={`Bölüm ${i + 1} Başlığı`} value={s.heading} onChange={v => update(s.id, 'heading', v)} />}
          </div>
          <div>
            <label style={lbl}>Bölüm İçeriği</label>
            <textarea style={{ ...ta(dir, 5), opacity: readOnly ? 0.6 : 1 }}
              value={s.body} onChange={e => !readOnly && update(s.id, 'body', e.target.value)}
              dir={dir} readOnly={readOnly} placeholder="Bölüm metnini girin…" />
             {!readOnly && <AIWriteAssist context="service" field="body" label="Bölüm İçeriği" value={s.body} onChange={v => update(s.id, 'body', v)} maxLength={5_000} />}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button onClick={add} style={{ border: '1px dashed #D1D5DB', background: 'transparent',
          color: '#6B7280', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer',
          fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
          + İçerik Bölümü Ekle
        </button>
      )}
    </div>
  );
}

// ── FAQ editor ─────────────────────────────────────────────────────────────

function FaqsEditor({ faqs, onChange, dir, readOnly }: {
  faqs: ServicePageFaq[];
  onChange: (f: ServicePageFaq[]) => void;
  dir: string; readOnly?: boolean;
}) {
  const add = () => onChange([...faqs, { id: crypto.randomUUID(), question: '', answer: '' }]);
  const remove = (id: string) => onChange(faqs.filter(f => f.id !== id));
  const update = (id: string, key: 'question' | 'answer', value: string) =>
    onChange(faqs.map(f => f.id === id ? { ...f, [key]: value } : f));

  return (
    <div>
      {faqs.length === 0 && !readOnly && (
        <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
          Henüz SSS yok. Soru-cevap çiftleri ekleyin.
        </p>
      )}
      {faqs.map((f, i) => (
        <div key={f.id} style={{
          border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px',
          marginBottom: '12px', background: '#FAFAFA',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              Soru {i + 1}
            </span>
            {!readOnly && (
              <button onClick={() => remove(f.id)} style={{ border: 'none', background: '#FEE2E2',
                color: '#DC2626', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                Sil
              </button>
            )}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Soru</label>
            <input style={{ ...inp(dir), opacity: readOnly ? 0.6 : 1 }}
              value={f.question} onChange={e => !readOnly && update(f.id, 'question', e.target.value)}
              dir={dir} readOnly={readOnly} placeholder="Sık sorulan soru…" />
            {!readOnly && <AIWriteAssist context="service" field="faq_question" label="SSS Sorusu" value={f.question} onChange={v => update(f.id, 'question', v)} />}
          </div>
          <div>
            <label style={lbl}>Cevap</label>
            <textarea style={{ ...ta(dir, 4), opacity: readOnly ? 0.6 : 1 }}
              value={f.answer} onChange={e => !readOnly && update(f.id, 'answer', e.target.value)}
              dir={dir} readOnly={readOnly} placeholder="Cevabı girin…" />
            {!readOnly && <AIWriteAssist context="service" field="faq_answer" label="SSS Cevabı" value={f.answer} onChange={v => update(f.id, 'answer', v)} maxLength={2_000} />}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button onClick={add} style={{ border: '1px dashed #D1D5DB', background: 'transparent',
          color: '#6B7280', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer',
          fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
          + SSS Ekle
        </button>
      )}
    </div>
  );
}

// ── Service Area editor ────────────────────────────────────────────────────

function ServiceAreaEditor({ serviceArea, onChange, dir, readOnly }: {
  serviceArea: ServicePageServiceArea | undefined;
  onChange: (sa: ServicePageServiceArea) => void;
  dir: string; readOnly?: boolean;
}) {
  const sa = serviceArea ?? { title: '', description: '', areas: [] };
  const set = (key: keyof ServicePageServiceArea, value: string | string[]) =>
    onChange({ ...sa, [key]: value });
  const setAreas = (raw: string) => set('areas', raw.split(',').map(a => a.trim()).filter(Boolean));

  return (
    <div>
      <Field name="Başlık" value={sa.title}
        onChange={v => !readOnly && set('title', v)} dir={dir} readOnly={readOnly}
        hint="Örn: Hizmet Alanlarımız" aiField="title" />
      <Field name="Açıklama" value={sa.description}
        onChange={v => !readOnly && set('description', v)} dir={dir} multiline rows={3} readOnly={readOnly} aiField="description" />
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Bölgeler / Lokasyonlar</label>
        <textarea
          style={{ ...ta(dir, 3), opacity: readOnly ? 0.6 : 1 }}
          value={sa.areas.join(', ')}
          onChange={e => !readOnly && setAreas(e.target.value)}
          dir={dir} readOnly={readOnly}
          placeholder="Virgülle ayırın: İstanbul, Ankara, Bursa, …"
        />
        <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>
          Bölge adlarını virgülle ayırın — her biri ayrı bir etiket olarak görünür.
        </p>
      </div>
    </div>
  );
}

// ── Audit log section ──────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  save_and_translate:    'Kaydedildi ve çeviri başlatıldı',
  save_draft:            'Taslak kaydedildi',
  edit_translation:      'Çeviri düzenlendi',
  translate:             'Yeniden çevrildi',
  approve_translation:   'Çeviri onaylandı',
  publish_translation:   'Çeviri yayımlandı',
  unpublish_translation: 'Çeviri yayından alındı',
  archive_source:        'Arşivlendi',
  publish_source:        'Yayımlandı',
  unpublish_source:      'Yayından alındı',
  duplicate:             'Kopyalandı',
};

interface AuditEntry {
  id: string; action: string; createdAt: string; adminName: string; locale: string | null;
}

function AuditLogSection({ contentId }: { contentId: string }) {
  const [loaded,  setLoaded]  = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/service-pages/${contentId}/audit`);
      if (res.ok) {
        const data = await res.json() as { entries: AuditEntry[] };
        setEntries(data.entries);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Değişiklik Geçmişi" collapsible defaultOpen={false}>
      {!loaded ? (
        <button onClick={load} disabled={loading} style={{ ...btnSecondary, fontSize: '12px', padding: '7px 16px' }}>
          {loading ? 'Yükleniyor…' : 'Geçmişi Göster'}
        </button>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          Henüz kayıt yok.
        </p>
      ) : (
        <div>
          {entries.map(e => (
            <div key={e.id} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontFamily: 'Inter, sans-serif',
            }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0, paddingTop: '1px' }}>
                {new Date(e.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12px', color: '#1E293B', fontWeight: 500 }}>
                  {ACTION_LABELS[e.action] ?? e.action}
                  {e.locale && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94A3B8' }}>({e.locale.toUpperCase()})</span>}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#94A3B8' }}>— {e.adminName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Translation locale panel ────────────────────────────────────────────────

function TranslationPanel({
  tx, locale, dir, slug, onAction, onSave,
}: {
  tx: ServicePageTranslation | undefined;
  locale: string;
  dir: 'ltr' | 'rtl';
  contentId: string;
  slug: string;
  onAction: (locale: string, action: string) => Promise<void>;
  onSave: (locale: string, data: {
    title: string; excerpt: string; body: ServicePageBody;
    metaTitle: string; metaDescription: string;
  }) => Promise<void>;
}) {
  const status  = tx?.status ?? 'NOT_STARTED';
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState<ServicePageBody | null>(tx?.body ?? null);
  const [editedTitle, setEditedTitle] = useState(tx?.title ?? '');
  const [editedExcerpt, setEditedExcerpt] = useState(tx?.excerpt ?? '');
  const [editedMetaTitle, setEditedMetaTitle] = useState(tx?.metaTitle ?? '');
  const [editedMetaDescription, setEditedMetaDescription] = useState(tx?.metaDescription ?? '');

  useEffect(() => {
    setEditing(false);
    setEditedBody(tx?.body ?? null);
    setEditedTitle(tx?.title ?? '');
    setEditedExcerpt(tx?.excerpt ?? '');
    setEditedMetaTitle(tx?.metaTitle ?? '');
    setEditedMetaDescription(tx?.metaDescription ?? '');
  }, [locale, tx]);

  const body = editedBody ?? tx?.body;
  const setBody = (updater: (body: ServicePageBody) => ServicePageBody) =>
    setEditedBody(current => current ? updater(current) : current);

  const doAction = async (action: string) => {
    setActionLoading(action);
    try { await onAction(locale, action); }
    finally { setActionLoading(null); }
  };
  const save = async () => {
    if (!body) return;
    setActionLoading('save');
    try {
      await onSave(locale, {
        title: editedTitle,
        excerpt: editedExcerpt,
        body,
        metaTitle: editedMetaTitle,
        metaDescription: editedMetaDescription,
      });
      setEditing(false);
    } finally { setActionLoading(null); }
  };

  const canApprove   = ['DRAFT', 'REVIEW', 'FAILED'].includes(status);
  const canPublish   = ['APPROVED', 'DRAFT', 'REVIEW'].includes(status);
  const canUnpublish = status === 'PUBLISHED';

  const btnStyle = (color: string, bg: string): React.CSSProperties => ({
    border: 'none', background: bg, color, borderRadius: '6px', padding: '6px 14px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
    opacity: actionLoading ? 0.5 : 1,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <StatusBadge status={status} />
        <button onClick={() => doAction('translate')} style={btnStyle('#1E293B', '#E2E8F0')} disabled={!!actionLoading}>
          {actionLoading === 'translate' ? 'Çevriliyor…' : '↺ Yeniden Çevir'}
        </button>
        {body && !editing && (
          <button onClick={() => setEditing(true)} style={btnStyle('#FFFFFF', '#4F46E5')} disabled={!!actionLoading}>
            Düzenle
          </button>
        )}
        {body && editing && (
          <>
            <button onClick={save} style={btnStyle('#FFFFFF', '#4F46E5')} disabled={!!actionLoading}>
              {actionLoading === 'save' ? 'Kaydediliyor…' : 'Çeviriyi Kaydet'}
            </button>
            <button onClick={() => { setEditing(false); setEditedBody(tx?.body ?? null); }} style={btnStyle('#475569', '#F1F5F9')} disabled={!!actionLoading}>
              Vazgeç
            </button>
          </>
        )}
        {canApprove && (
          <button onClick={() => doAction('approve')} style={btnStyle('#FFFFFF', '#0891B2')} disabled={!!actionLoading}>
            {actionLoading === 'approve' ? '…' : '✓ Onayla'}
          </button>
        )}
        {canPublish && (
          <button onClick={() => doAction('publish')} style={btnStyle('#FFFFFF', '#059669')} disabled={!!actionLoading}>
            {actionLoading === 'publish' ? '…' : '▶ Yayımla'}
          </button>
        )}
        {canUnpublish && (
          <button onClick={() => doAction('unpublish')} style={btnStyle('#92400E', '#FEF3C7')} disabled={!!actionLoading}>
            {actionLoading === 'unpublish' ? '…' : '⏸ Yayından Al'}
          </button>
        )}
        <a
          href={`/${locale}/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '11px', fontWeight: 600, color: '#0891B2', textDecoration: 'none',
            padding: '6px 12px', background: '#ECFEFF', borderRadius: '6px',
            border: '1px solid #BAE6FD', fontFamily: 'Inter, sans-serif',
            marginLeft: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center',
          }}
        >
          Önizle ↗
        </a>
      </div>

      {status === 'OUTDATED' && (
        <div style={{
          padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA',
          borderRadius: '8px', marginBottom: '16px', fontSize: '12px',
          color: '#92400E', fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
        }}>
          ⚠️ <strong>Güncel değil:</strong> Türkçe kaynak içerik değişti.{' '}
          Bu çeviri public sayfada <em>eski içerikle</em> görünüyor.{' '}
          <strong>↺ Yeniden Çevir</strong> ile yenileyin, ardından onaylayıp yayımlayın.
          Onaylanmadan tekrar yayımlanamaz.
        </div>
      )}
      {tx?.failureReason && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#B91C1C', fontFamily: 'Inter, sans-serif' }}>
          Hata: {tx.failureReason}
        </div>
      )}

      {body && (
        <>
          {editing && (
            <SectionCard title="Çeviri Temel Bilgileri">
              <Field name="Sayfa Başlığı" value={editedTitle} onChange={setEditedTitle} dir={dir} />
              <Field name="Kısa Açıklama" value={editedExcerpt} onChange={setEditedExcerpt} multiline rows={3} dir={dir} />
            </SectionCard>
          )}
          <SectionCard title="Hero">
            <Field name="Badge" value={body.hero.badge} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, badge: v } }))} dir={dir} readOnly={!editing} />
            <Field name="Başlık" value={body.hero.title} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, title: v } }))} dir={dir} readOnly={!editing} />
            <Field name="Alt Başlık" value={body.hero.subtitle} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, subtitle: v } }))} multiline rows={3} dir={dir} readOnly={!editing} />
            <Field name="Breadcrumb" value={body.hero.crumb} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, crumb: v } }))} dir={dir} readOnly={!editing} />
            <div className="spe-cols-2">
              <Field name="CTA Birincil" value={body.hero.ctaPrimary} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, ctaPrimary: v } }))} dir={dir} readOnly={!editing} />
              <Field name="CTA İkincil" value={body.hero.ctaSecondary} onChange={v => setBody(b => ({ ...b, hero: { ...b.hero, ctaSecondary: v } }))} dir={dir} readOnly={!editing} />
            </div>
          </SectionCard>
          {body.introBody && (
            <SectionCard title="Giriş Metni">
              <Field name="Giriş Paragrafı" value={body.introBody} onChange={v => setBody(b => ({ ...b, introBody: v || undefined }))} multiline rows={5} dir={dir} readOnly={!editing} />
            </SectionCard>
          )}
          <SectionCard title="Özellikler">
            <FeaturesEditor features={body.features} onChange={features => setBody(b => ({ ...b, features }))} dir={dir} readOnly={!editing} />
          </SectionCard>
          {(body.contentSections?.length || editing) && (
            <SectionCard title="İçerik Bölümleri">
              <ContentSectionsEditor sections={body.contentSections ?? []} onChange={contentSections => setBody(b => ({ ...b, contentSections }))} dir={dir} readOnly={!editing} />
            </SectionCard>
          )}
          {(body.serviceArea || editing) && (
            <SectionCard title="Hizmet Alanı">
              <ServiceAreaEditor serviceArea={body.serviceArea} onChange={serviceArea => setBody(b => ({ ...b, serviceArea }))} dir={dir} readOnly={!editing} />
            </SectionCard>
          )}
          {(body.faqs?.length || editing) && (
            <SectionCard title="SSS">
              <FaqsEditor faqs={body.faqs ?? []} onChange={faqs => setBody(b => ({ ...b, faqs }))} dir={dir} readOnly={!editing} />
            </SectionCard>
          )}
          <SectionCard title="SEO / OG">
            <Field name="OG Başlık" value={body.seo.ogTitle} onChange={v => setBody(b => ({ ...b, seo: { ...b.seo, ogTitle: v } }))} dir={dir} readOnly={!editing} />
            <Field name="OG Açıklama" value={body.seo.ogDescription} onChange={v => setBody(b => ({ ...b, seo: { ...b.seo, ogDescription: v } }))} multiline dir={dir} readOnly={!editing} />
            <Field name="Meta Başlık" value={editedMetaTitle} onChange={setEditedMetaTitle} dir={dir} readOnly={!editing} maxLen={60} />
            <Field name="Meta Açıklama" value={editedMetaDescription} onChange={setEditedMetaDescription} multiline dir={dir} readOnly={!editing} maxLen={160} />
          </SectionCard>
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

interface Props { initialRecord: ServicePageRecord }

const DEFAULT_BODY: ServicePageBody = {
  version: 2,
  hero: { badge: '', title: '', subtitle: '', crumb: '', ctaPrimary: 'Fiyat Al / Rezervasyon', ctaSecondary: 'Hemen Ara' },
  features: [],
  seo: { ogTitle: '', ogDescription: '' },
};

export default function ServicePageEditor({ initialRecord }: Props) {
  const [record,       setRecord]       = useState<ServicePageRecord>(initialRecord);
  const [activeLocale, setActiveLocale] = useState('tr');
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TR editable state ────────────────────────────────────────────────────
  const [title,        setTitle]        = useState(record.title);
  const [excerpt,      setExcerpt]      = useState(record.excerpt ?? '');
  const [isActive,     setIsActive]     = useState(record.isActive);
  const [indexable,    setIndexable]    = useState(record.indexable);
  const [displayOrder, setDisplayOrder] = useState(record.displayOrder);
  const [category,     setCategory]     = useState(record.category ?? '');
  const [showOnHomepage, setShowOnHomepage] = useState(record.showOnHomepage);
  const [showInNav,    setShowInNav]    = useState(record.showInNav);
  const [seoTitle,     setSeoTitle]     = useState(record.seoTitle ?? '');
  const [seoDesc,      setSeoDesc]      = useState(record.seoDescription ?? '');
  const [heroImage,    setHeroImage]    = useState(record.heroImage ?? '');
  const [heroImageAlt, setHeroImageAlt] = useState(record.heroImageAlt ?? '');
  const [ogImage,      setOgImage]      = useState(record.ogImage ?? '');

  // ── Dynamic category options from DB ─────────────────────────────────────
  const [catOptions, setCatOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetch('/admin/api/categories')
      .then(r => r.json())
      .then((d: { categories?: { slug: string; nameTranslations: Record<string,string> }[] }) => {
        if (d.categories) {
          setCatOptions(d.categories.map(c => ({
            value: c.slug,
            label: c.nameTranslations?.['tr'] ?? c.slug,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // ── Body state (v2) ──────────────────────────────────────────────────────
  // For a PUBLISHED page with pending draft changes, initialise from draftBody
  // so the admin sees their pending edits rather than the live content.
  const hasPendingDraft = record.status === 'PUBLISHED' && record.draftBody !== null;
  const [body, setBody] = useState<ServicePageBody>(
    (hasPendingDraft ? record.draftBody : null) ?? record.body ?? DEFAULT_BODY
  );

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const setHero = (key: keyof ServicePageBody['hero'], val: string) =>
    setBody(b => ({ ...b, hero: { ...b.hero, [key]: val } }));
  const setSeo = (key: keyof ServicePageBody['seo'], val: string) =>
    setBody(b => ({ ...b, seo: { ...b.seo, [key]: val } }));

  // ── Save helper ──────────────────────────────────────────────────────────
  const doSave = async (saveAsDraft: boolean) => {
    // ── Required-field validation ──────────────────────────────────────────
    if (!title.trim()) {
      showToast('error', 'Sayfa başlığı boş olamaz.');
      return;
    }
    if (!body.hero.title.trim()) {
      showToast('error', 'Hero başlığı (H1) boş olamaz.');
      return;
    }
    if (!saveAsDraft && !seoTitle.trim()) {
      showToast('error', 'Yayımlamak için meta başlık zorunludur (SEO bölümü).');
      return;
    }

    setSaving(true);
    try {
      const bodyV2: ServicePageBody = { ...body, version: 2 };
      const res = await fetch(`/admin/api/service-pages/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, excerpt: excerpt || null,
          body: bodyV2,
          seoTitle: seoTitle || null,
          seoDescription: seoDesc || null,
          heroImage: heroImage || null,
          heroImageAlt: heroImageAlt || null,
          ogImage: ogImage || null,
          indexable, isActive, displayOrder,
          category: category || null,
          showOnHomepage, showInNav,
          saveAsDraft,
          autoTranslate: true,
        }),
      });
      const data = await safeJson<{ record?: ServicePageRecord; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Kaydetme hatası.');
      if (data.record) setRecord(data.record);
      showToast('success', saveAsDraft
        ? 'Taslak kaydedildi. Çeviri taslakları oluşturuluyor…'
        : 'Yayımlandı. Çeviri taslakları oluşturuluyor…');
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

  const saveTranslation = useCallback(async (
    locale: string,
    translation: {
      title: string; excerpt: string; body: ServicePageBody;
      metaTitle: string; metaDescription: string;
    },
  ) => {
    const res = await fetch(`/admin/api/service-pages/${record.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveTranslation', locale, ...translation }),
    });
    const data = await safeJson<{ record?: ServicePageRecord; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? 'Çeviri kaydedilemedi.');
    if (data.record) setRecord(data.record);
    showToast('success', 'Çeviri kaydedildi ve ziyaretçi sayfası güncellendi.');
  }, [record.id, showToast]);

  const currentTx     = record.translations.find(t => t.locale === activeLocale);
  const currentLocale = ALL_LOCALES.find(l => l.code === activeLocale) ?? ALL_LOCALES[0];

  // Canonical URL (auto-generated, read-only)
  const canonicalUrl = `https://www.istanbulviptransfer.com/tr/${record.slug}`;
  const publishedServiceUrl = `${SITE.siteUrl}/${record.slug}`;
  const serviceShareSummary = record.excerpt ?? body.hero.subtitle;

  // A translation is visitor-ready once its content is complete. This action
  // lets an admin confirm the catalog's public workflow in a single click.
  const publishableTranslations = record.translations.filter(
    t => ['DRAFT', 'REVIEW', 'APPROVED'].includes(t.status),
  );

  return (
    <div className="spe-root" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── Responsive CSS ─────────────────────────────────────────────────── */}
      <style>{`
        .spe-root { width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; }
        .spe-root * { box-sizing: border-box; }
        /* 2-column grids collapse to 1 column below 768 px */
        .spe-cols-2    { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .spe-cols-2-16 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .spe-cols-2-8  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        /* Header / action bar */
        .spe-header      { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
        .spe-action-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        /* Locale tabs — wrap, never horizontal scroll */
        .spe-locale-tabs { display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; }
        /* Bulk-publish summary bar */
        .spe-bulk-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px;
          background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px;
          margin-bottom: 20px; flex-wrap: wrap; }
        /* ── ≤ 767 px: tight mobile ──────────────────────────────────────── */
        @media (max-width: 767px) {
          .spe-cols-2    { grid-template-columns: 1fr !important; }
          .spe-cols-2-16 { grid-template-columns: 1fr !important; }
          .spe-cols-2-8  { grid-template-columns: 1fr !important; }
          .spe-header { flex-direction: column; align-items: flex-start; }
          .spe-action-btns { width: 100%; }
          .spe-action-btns button { flex: 1; min-height: 44px; font-size: 13px !important; }
          .spe-bulk-bar { flex-direction: column; align-items: stretch; }
          .spe-bulk-bar button { width: 100% !important; min-height: 44px; }
        }
      `}</style>
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

      {/* Pending draft banner — shown when PUBLISHED page has unsaved draft changes */}
      {hasPendingDraft && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px',
          padding: '10px 16px', marginBottom: '16px', fontSize: '13px',
          fontFamily: 'Inter, sans-serif', color: '#92400E', display: 'flex',
          alignItems: 'center', gap: '8px',
        }}>
          <span>⚠️</span>
          <span>
            Bu sayfa yayında. <strong>Taslak Kaydet</strong> yalnızca içerik metnini (body) saklar;
            başlık, SEO ve görsel alanlar yayımlanana kadar değişmez.
            Tüm değişiklikleri canlıya almak için <strong>Kaydet ve Yayımla</strong>&apos;yı kullanın.
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="spe-header">
        <div>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>/{record.slug}</p>
          <StatusBadge status={record.status} />
        </div>
        {activeLocale === 'tr' && (
          <div className="spe-action-btns">
            <FacebookShareButton
              url={publishedServiceUrl}
              label="Bu hizmeti Facebook'ta paylaş"
              disabled={record.status !== 'PUBLISHED' || !record.isActive}
              style={{ padding: '10px 16px', fontSize: 13 }}
            />
            <XShareButton
              title={record.title}
              summary={serviceShareSummary}
              url={publishedServiceUrl}
              label="Bu hizmeti X'te paylaş"
              disabled={record.status !== 'PUBLISHED' || !record.isActive}
              style={{ background: '#172B3A', borderColor: '#172B3A', padding: '10px 16px', fontSize: 13 }}
            />
            <button onClick={() => doSave(true)} disabled={saving} style={{ ...btnSecondary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Kaydediliyor…' : (record.status === 'PUBLISHED' ? 'Taslak Kaydet' : 'Taslak Kaydet ve Çevir')}
            </button>
            <button onClick={() => doSave(false)} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Kaydediliyor…' : '▶ Kaydet ve Yayımla'}
            </button>
          </div>
        )}
      </div>

      {/* Locale tabs */}
      <div className="spe-locale-tabs">
        {ALL_LOCALES.map(loc => {
          const tx     = record.translations.find(t => t.locale === loc.code);
          const status = loc.code === 'tr' ? record.status : (tx?.status ?? 'NOT_STARTED');
          const s      = TX_STATUS[status] ?? TX_STATUS.NOT_STARTED;
          const active = activeLocale === loc.code;
          return (
            <button key={loc.code} onClick={() => setActiveLocale(loc.code)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
              fontWeight: active ? 700 : 400, cursor: 'pointer', flexShrink: 0,
              background: active ? '#1E293B' : '#F1F5F9',
              color: active ? '#FFFFFF' : '#374151',
              border: `1px solid ${active ? '#1E293B' : '#E2E8F0'}`,
            }}>
              {loc.label}
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* ── Bulk-publish / translation summary bar (TR tab) ─────────────── */}
      {activeLocale === 'tr' && (
        <div className="spe-bulk-bar">
          {/* Mini status dots for every translation locale */}
          <div style={{ flex: 1, fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <strong style={{ flexShrink: 0 }}>Çeviri:</strong>
            {record.translations.map(t => {
              const s = TX_STATUS[t.status] ?? TX_STATUS.NOT_STARTED;
              return (
                <span key={t.locale} title={`${t.locale.toUpperCase()}: ${s.label}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px',
                    padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color, fontWeight: 600 }}>
                  {t.locale.toUpperCase()}
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                </span>
              );
            })}
          </div>
          {publishableTranslations.length > 0 ? (
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await Promise.allSettled(
                    publishableTranslations.map(t => handleTranslationAction(t.locale, 'publish')),
                  );
                  showToast('success', `${publishableTranslations.length} çeviri yayımlandı.`);
                } finally { setSaving(false); }
              }}
              disabled={saving}
              style={{ ...btnPrimary, fontSize: '12px', padding: '8px 18px', flexShrink: 0, opacity: saving ? 0.5 : 1 }}
            >
              ▶ Hazır Çevirileri Toplu Yayımla ({publishableTranslations.length})
            </button>
          ) : (
            <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
              {record.translations.every(t => t.status === 'PUBLISHED')
                ? '✓ Tüm çeviriler yayında'
                : record.translations.every(t => t.status === 'NOT_STARTED')
                ? 'TR kaydet → çeviri otomatik başlar'
                : 'Taslak çevirileri sekmelerde inceleyip yayımlayın'}
            </span>
          )}
        </div>
      )}

      {/* ── TR editor pane ───────────────────────────────────────────────── */}
      {activeLocale === 'tr' && (
        <>
          {/* Temel Bilgiler */}
          <SectionCard title="Temel Bilgiler">
            <Field name="Sayfa Başlığı (Admin)" value={title} onChange={setTitle} aiField="title" />
            <Field name="Kısa Açıklama (Excerpt)" value={excerpt} onChange={setExcerpt} multiline rows={3}
              hint="Hizmet kartlarında ve meta açıklamada kullanılabilir." aiField="description" />
            <div className="spe-cols-2-16">
              <div>
                <label style={lbl}>Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp(), cursor: 'pointer' }}>
                  <option value="">— Seçiniz —</option>
                  {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Sıra</label>
                <input type="number" value={displayOrder}
                  onChange={e => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  style={{ ...inp(), width: '100px' }} />
              </div>
            </div>
            <div className="spe-cols-2-8">
              <Checkbox name="Aktif (sitede göster)" checked={isActive} onChange={setIsActive} />
              <Checkbox name="Arama motorlarında dizinle" checked={indexable} onChange={setIndexable} />
            </div>
          </SectionCard>

          {/* Görünürlük */}
          <SectionCard title="Görünürlük">
            <Checkbox
              name="Ana sayfada göster"
              checked={showOnHomepage}
              onChange={setShowOnHomepage}
              hint="Hizmet kartı ana sayfadaki hizmetler bölümünde görünür."
            />
            <Checkbox
              name="Navigasyonda göster (header / footer / mobil menü)"
              checked={showInNav}
              onChange={setShowInNav}
              hint="Hizmet bağlantısı navigasyon menülerinde listelenir."
            />
          </SectionCard>

          {/* Hero */}
          <SectionCard title="Hero Bölümü">
            <Field name="Badge / Rozet" value={body.hero.badge} onChange={v => setHero('badge', v)} aiField="short_text" />
            <Field name="Başlık (H1)" value={body.hero.title} onChange={v => setHero('title', v)} aiField="title" />
            <Field name="Alt Başlık" value={body.hero.subtitle} onChange={v => setHero('subtitle', v)} multiline rows={3} aiField="description" />
            <Field name="Breadcrumb Etiketi" value={body.hero.crumb} onChange={v => setHero('crumb', v)}
              hint="Navigasyonda görünecek kısa etiket" />
            <div className="spe-cols-2">
              <Field name="CTA Birincil" value={body.hero.ctaPrimary} onChange={v => setHero('ctaPrimary', v)} aiField="cta" />
              <Field name="CTA İkincil" value={body.hero.ctaSecondary} onChange={v => setHero('ctaSecondary', v)} aiField="cta" />
            </div>
          </SectionCard>

          {/* Giriş Metni */}
          <SectionCard title="Giriş Metni">
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>
              Hero altında görünen tanıtım paragrafı. Boş bırakılırsa gösterilmez.
            </p>
            <Field
              name="Giriş Paragrafı"
              value={body.introBody ?? ''}
              onChange={v => setBody(b => ({ ...b, introBody: v || undefined }))}
              multiline rows={6}
              hint="Bu metin otomatik olarak çevrilir."
              aiField="body"
            />
          </SectionCard>

          {/* Özellikler */}
          <SectionCard title="Özellikler Listesi">
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
              Sayfada gösterilecek servis özelliklerini girin.
            </p>
            <FeaturesEditor
              features={body.features}
              onChange={f => setBody(b => ({ ...b, features: f }))}
              dir="ltr"
            />
          </SectionCard>

          {/* İçerik Bölümleri */}
          <SectionCard title="İçerik Bölümleri (H2/H3)">
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
              Yapılandırılmış içerik bölümleri. Her bölüm H2 veya H3 başlığıyla başlar.
            </p>
            <ContentSectionsEditor
              sections={body.contentSections ?? []}
              onChange={s => setBody(b => ({ ...b, contentSections: s }))}
              dir="ltr"
            />
          </SectionCard>

          {/* Hizmet Alanı */}
          <SectionCard title="Hizmet Alanı Bilgisi" collapsible defaultOpen={false}>
            <ServiceAreaEditor
              serviceArea={body.serviceArea}
              onChange={sa => setBody(b => ({ ...b, serviceArea: sa }))}
              dir="ltr"
            />
          </SectionCard>

          {/* SSS / FAQ */}
          <SectionCard title="SSS — Sık Sorulan Sorular">
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
              FAQ eklemeniz FAQPage JSON-LD şeması oluşturur ve SEO&apos;ya katkı sağlar.
            </p>
            <FaqsEditor
              faqs={body.faqs ?? []}
              onChange={f => setBody(b => ({ ...b, faqs: f }))}
              dir="ltr"
            />
          </SectionCard>

          {/* Görseller */}
          <SectionCard title="Görseller">
            <ImageUploadField
              label="Hero Görseli"
              value={heroImage}
              onChange={setHeroImage}
              namespace={`service-pages/${record.slug}`}
              hint="Her hizmet için konuya özel görsel kullanın; varsayılan/ortak görsel kullanılamaz. Görselde yazı, logo, marka amblemi, okunabilir tabela veya plaka olmamalı; kişiler yalnızca arkadan, profilden ya da uzaktan görünmelidir."
              altValue={heroImageAlt}
              onAltChange={setHeroImageAlt}
              altLabel="Hero Görseli ALT Metni (Türkçe — çeviride ayrıca lokalize edilir)"
            />
            <ImageUploadField
              label="OG / Sosyal Medya Görseli"
              value={ogImage}
              onChange={setOgImage}
              namespace={`service-pages/${record.slug}`}
              hint="Hizmete özel sosyal görsel. 1200×630 önerilir. Yazı, logo, marka amblemi, okunabilir tabela/plaka ve önden yakın insan yüzü içermeyen bir görsel seçin."
            />
          </SectionCard>

          {/* SEO */}
          <SectionCard title="SEO">
            <Field name="OG Başlık (Sosyal Paylaşım)" value={body.seo.ogTitle}
              onChange={v => setSeo('ogTitle', v)} maxLen={60} aiField="seo_title" />
            <Field name="OG Açıklama" value={body.seo.ogDescription}
              onChange={v => setSeo('ogDescription', v)} multiline rows={3} maxLen={160} aiField="seo_description" />
            <Field name="Meta Başlık (Tarayıcı Sekmesi)" value={seoTitle} onChange={setSeoTitle}
              maxLen={60} hint="Tarayıcı sekmesi ve Google arama sonucu başlığı. Yayımlamak için zorunlu." aiField="seo_title" />
            <Field name="Meta Açıklama" value={seoDesc} onChange={setSeoDesc}
              multiline rows={3} maxLen={160} hint="Google arama sonucu açıklama metni." aiField="seo_description" />
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Canonical URL</label>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                  background: '#EFF6FF', color: '#2563EB', fontFamily: 'Inter, sans-serif' }}>
                  Paylaşılan alan
                </span>
              </div>
              <input value={canonicalUrl} readOnly style={{ ...inp(), opacity: 0.6, background: '#F8FAFC' }} />
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>
                Sistem tarafından otomatik oluşturulur — düzenlenemez. Tüm dillerde aynı canonical kullanılır.
              </p>
            </div>
          </SectionCard>

          {/* ── Schema.org Extras ──────────────────────────────────────────── */}
          <SectionCard title="Yapısal Veri (Schema.org)" collapsible defaultOpen={false}>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              Bu alanlar Google arama sonuçlarında zengin snippet oluşturmak için kullanılır.
              Tercümelere yansımaz. Boş bırakılabilir.
            </p>
            <Field
              name="Hizmet Türü (serviceType)"
              value={body.schemaExtras?.serviceType ?? ''}
              onChange={v => setBody(b => ({ ...b, schemaExtras: { ...b.schemaExtras, serviceType: v } }))}
              hint='Örn: "Airport Transfer", "Limousine Service", "Day Tour"'
            />
            <Field
              name="Çalışma Saatleri (openingHours)"
              value={body.schemaExtras?.openingHours ?? ''}
              onChange={v => setBody(b => ({ ...b, schemaExtras: { ...b.schemaExtras, openingHours: v } }))}
              hint='Örn: "Mo-Su 00:00-24:00" — Schema.org biçimi'
            />
            <Field
              name="Fiyat Aralığı (priceRange)"
              value={body.schemaExtras?.priceRange ?? ''}
              onChange={v => setBody(b => ({ ...b, schemaExtras: { ...b.schemaExtras, priceRange: v } }))}
              hint='Örn: "₺₺" — Genel fiyat seviyesi'
            />
            <Field
              name="Diller (availableLanguage)"
              value={(body.schemaExtras?.availableLanguage ?? []).join(', ')}
              onChange={v => setBody(b => ({
                ...b,
                schemaExtras: {
                  ...b.schemaExtras,
                  availableLanguage: v.split(',').map(s => s.trim()).filter(Boolean),
                },
              }))}
              hint='Virgülle ayırın. Örn: "Turkish, English, Arabic"'
            />
          </SectionCard>

          {/* Audit log */}
          <AuditLogSection contentId={record.id} />
        </>
      )}

      {/* ── Translation pane ─────────────────────────────────────────────── */}
      {activeLocale !== 'tr' && (
        <TranslationPanel
          tx={currentTx}
          locale={activeLocale}
          dir={currentLocale.dir}
          contentId={record.id}
          slug={record.slug}
          onAction={handleTranslationAction}
          onSave={saveTranslation}
        />
      )}
    </div>
  );
}
