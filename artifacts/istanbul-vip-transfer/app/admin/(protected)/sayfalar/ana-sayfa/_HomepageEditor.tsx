'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { HomepageAdminRecord } from '@/lib/homepage-cms';
import type {
  HomepageSections, HeroSection, HeroStat, ServicesSectionData,
  TrustSectionData, VehiclesSectionData, ReviewsSectionData,
  ReservationSectionData, ContactSectionData, FooterSectionData,
  HomepageSeoData,
} from '@/lib/homepage-types';
import { HOMEPAGE_FALLBACK } from '@/lib/homepage-types';

// ── Safe JSON fetch helper ─────────────────────────────────────────────────
// Reads response.text() first so an empty body or HTML error page never throws
// "Unexpected end of JSON input". Returns parsed JSON or throws with a clean message.
async function safeJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const ct = res.headers.get('content-type') ?? '';
  if (!text.trim()) {
    throw new Error(`Sunucu boş yanıt döndürdü (HTTP ${res.status}).`);
  }
  if (!ct.includes('json')) {
    // Likely an HTML error page — show truncated text
    throw new Error(`Sunucudan beklenmeyen yanıt alındı (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON ayrıştırma hatası (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const LOCALES = [
  { code: 'tr', label: 'Türkçe 🇹🇷', dir: 'ltr', isSource: true },
  { code: 'en', label: 'English 🇬🇧', dir: 'ltr', isSource: false },
  { code: 'de', label: 'Deutsch 🇩🇪', dir: 'ltr', isSource: false },
  { code: 'ru', label: 'Русский 🇷🇺', dir: 'ltr', isSource: false },
  { code: 'ar', label: 'العربية 🇸🇦', dir: 'rtl', isSource: false },
] as const;

const SECTIONS = [
  { key: 'hero',        label: 'A · Hero' },
  { key: 'heroStats',   label: 'B · İstatistikler' },
  { key: 'services',    label: 'C · Hizmetler' },
  { key: 'trust',       label: 'D · Güven Kartları' },
  { key: 'vehicles',    label: 'E · Araçlar' },
  { key: 'reviews',     label: 'F · Yorumlar' },
  { key: 'reservation', label: 'G · Rezervasyon' },
  { key: 'contact',     label: 'H · İletişim' },
  { key: 'footer',      label: 'I · Footer' },
  { key: 'seo',         label: 'J · SEO' },
] as const;

// Translation status display config
const TX_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  NOT_STARTED:  { label: 'Başlamadı',        color: '#94A3B8', bg: '#F8FAFC' },
  QUEUED:       { label: 'Çeviri bekliyor',  color: '#D97706', bg: '#FFFBEB' },
  TRANSLATING:  { label: 'Çevriliyor…',      color: '#2563EB', bg: '#EFF6FF' },
  DRAFT:        { label: 'İnceleme gerekli', color: '#9333EA', bg: '#FAF5FF' },
  REVIEW:       { label: 'İnceleme gerekli', color: '#9333EA', bg: '#FAF5FF' },
  APPROVED:     { label: 'Onaylandı',        color: '#16A34A', bg: '#F0FDF4' },
  PUBLISHED:    { label: 'Yayında',          color: '#059669', bg: '#ECFDF5' },
  FAILED:       { label: 'Hata',             color: '#DC2626', bg: '#FEF2F2' },
  OUTDATED:     { label: 'Kaynak değişti',   color: '#EA580C', bg: '#FFF7ED' },
  ARCHIVED:     { label: 'Arşiv',            color: '#64748B', bg: '#F1F5F9' },
};

// ── Shared style helpers ───────────────────────────────────────────────────

const inp = (dir?: string): React.CSSProperties => ({
  width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
  borderRadius: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
  color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box',
  direction: dir as React.CSSProperties['direction'],
});
const ta = (dir?: string, rows = 3): React.CSSProperties => ({ ...inp(dir), resize: 'vertical', minHeight: `${rows * 22 + 16}px` });
const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', marginBottom: '4px', display: 'block' };

function Field({ name, value, onChange, multiline, rows, dir, hint, readOnly }: {
  name: string; value: string; onChange?: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={lbl}>{name}</label>
      {multiline
        ? <textarea style={{ ...ta(dir, rows), opacity: readOnly ? 0.6 : 1 }} value={value} onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
        : <input style={{ ...inp(dir), opacity: readOnly ? 0.6 : 1 }} value={value} onChange={e => onChange?.(e.target.value)} dir={dir} readOnly={readOnly} />
      }
      {hint && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>{hint}</p>}
    </div>
  );
}

function Checkbox({ name, checked, onChange }: { name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: '16px', height: '16px' }} />
      {name}
    </label>
  );
}

// ── Section editors ────────────────────────────────────────────────────────

function HeroEditor({ data, onChange, dir, ro }: { data: HeroSection; onChange: (d: HeroSection) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof HeroSection, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Badge / Rozet" value={data.badge} onChange={v => set('badge', v)} dir={dir} readOnly={ro} />
      <div className="hpe-fg2">
        <Field name="Başlık 1" value={data.headline1} onChange={v => set('headline1', v)} dir={dir} readOnly={ro} />
        <Field name="Vurgulanan Kelime" value={data.headlineAccent} onChange={v => set('headlineAccent', v)} dir={dir} readOnly={ro} />
      </div>
      <Field name="Başlık 2" value={data.headline2} onChange={v => set('headline2', v)} dir={dir} readOnly={ro} />
      <Field name="Alt Başlık" value={data.subheadline} onChange={v => set('subheadline', v)} multiline rows={3} dir={dir} readOnly={ro} />
      <div className="hpe-fg2">
        <Field name="CTA Rezervasyon" value={data.ctaBookingText} onChange={v => set('ctaBookingText', v)} dir={dir} readOnly={ro} />
        <Field name="CTA Ara" value={data.ctaCallText} onChange={v => set('ctaCallText', v)} dir={dir} readOnly={ro} />
      </div>
      <Field name="Hero Görseli Yolu" value={data.imagePath} onChange={v => set('imagePath', v)} hint="Paylaşılan alan — tüm dillerde aynıdır" readOnly={ro} />
      <Field name="Görsel ALT Metni" value={data.imageAlt} onChange={v => set('imageAlt', v)} dir={dir} readOnly={ro} />
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function StatsEditor({ data, onChange, dir, ro }: { data: HeroStat[]; onChange: (d: HeroStat[]) => void; dir: string; ro?: boolean }) {
  const set = (i: number, key: keyof HeroStat, val: string | boolean | number) => {
    const next = [...data]; next[i] = { ...next[i], [key]: val }; onChange(next);
  };
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Sayı metinleri (IST &amp; SAW, 7/24, Vito &amp; Sprinter) paylaşılan alanlardır — LTR korunur. Sadece etiket çevrilir.
      </p>
      {data.map((stat, i) => (
        <div key={stat.key} style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '12px', background: '#F8FAFC' }}>
          <p style={{ ...lbl, marginBottom: '10px', color: '#C79A35' }}>{stat.key.toUpperCase()} — <span dir="ltr">{stat.numberText}</span></p>
          <Field name="Etiket (çeviri)" value={stat.label} onChange={v => set(i, 'label', v)} dir={dir} readOnly={ro} />
        </div>
      ))}
    </div>
  );
}

function ServicesSectionEditor({ data, onChange, dir, ro }: { data: ServicesSectionData; onChange: (d: ServicesSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof ServicesSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} readOnly={ro} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} readOnly={ro} />
      <div className="hpe-fg2">
        <Field name="Tüm Hizmetler Buton Metni" value={data.allServicesText} onChange={v => set('allServicesText', v)} dir={dir} readOnly={ro} />
        <Field name="Tüm Hizmetler Yolu" value={data.allServicesRoute} onChange={v => set('allServicesRoute', v)} hint="Paylaşılan alan" readOnly={ro} />
      </div>
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function TrustEditor({ data, onChange, dir, ro }: { data: TrustSectionData; onChange: (d: TrustSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: 'eyebrow' | 'heading' | 'enabled', val: string | boolean) => onChange({ ...data, [key]: val });
  const setCard = (i: number, key: string, val: string | boolean) => {
    const cards = [...data.cards]; cards[i] = { ...cards[i], [key]: val }; onChange({ ...data, cards });
  };
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} readOnly={ro} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
      <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />
      {data.cards.map((card, i) => (
        <div key={card.id} style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '12px', background: '#F8FAFC' }}>
          <Field name={`Kart ${i + 1} Başlık`} value={card.title} onChange={v => setCard(i, 'title', v)} dir={dir} readOnly={ro} />
          <Field name="Açıklama" value={card.description} onChange={v => setCard(i, 'description', v)} multiline rows={2} dir={dir} readOnly={ro} />
        </div>
      ))}
    </div>
  );
}

function VehiclesEditor({ data, onChange, dir, ro }: { data: VehiclesSectionData; onChange: (d: VehiclesSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof VehiclesSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} readOnly={ro} />
      <div className="hpe-fg2">
        <Field name="Buton Metni" value={data.ctaText} onChange={v => set('ctaText', v)} dir={dir} readOnly={ro} />
        <Field name="Buton Yolu" value={data.ctaRoute} onChange={v => set('ctaRoute', v)} hint="Paylaşılan alan" readOnly={ro} />
      </div>
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function ReviewsSectionEditor({ data, onChange, dir, ro }: { data: ReviewsSectionData; onChange: (d: ReviewsSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof ReviewsSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} readOnly={ro} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      <Field name="Tüm Yorumlar Buton Metni" value={data.viewAllText} onChange={v => set('viewAllText', v)} dir={dir} readOnly={ro} />
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function ReservationEditor({ data, onChange, dir, ro }: { data: ReservationSectionData; onChange: (d: ReservationSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof ReservationSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} readOnly={ro} />
      <Field name="Başlık" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} readOnly={ro} />
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function ContactEditor({ data, onChange, dir, ro }: { data: ContactSectionData; onChange: (d: ContactSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof ContactSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} readOnly={ro} />
      <Field name="Başlık" value={data.heading} onChange={v => set('heading', v)} dir={dir} readOnly={ro} />
      <Field name="Alt Başlık" value={data.subheading} onChange={v => set('subheading', v)} multiline dir={dir} readOnly={ro} />
      <Field name="WhatsApp Buton Metni" value={data.whatsappCtaText} onChange={v => set('whatsappCtaText', v)} dir={dir} readOnly={ro} />
      {!ro && <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />}
    </div>
  );
}

function FooterEditor({ data, onChange, dir, ro }: { data: FooterSectionData; onChange: (d: FooterSectionData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof FooterSectionData, val: string) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Marka Sloganı (kısa)" value={data.premiumTagline} onChange={v => set('premiumTagline', v)} dir={dir} readOnly={ro} />
      <Field name="Alt Satır Açıklama" value={data.tagline} onChange={v => set('tagline', v)} multiline dir={dir} readOnly={ro} />
      <div className="hpe-fg3">
        <Field name="Sütun 1 Başlığı" value={data.col1Heading} onChange={v => set('col1Heading', v)} dir={dir} readOnly={ro} />
        <Field name="Sütun 2 Başlığı" value={data.col2Heading} onChange={v => set('col2Heading', v)} dir={dir} readOnly={ro} />
        <Field name="Sütun 3 Başlığı" value={data.col3Heading} onChange={v => set('col3Heading', v)} dir={dir} readOnly={ro} />
      </div>
      <Field name="Telif Hakkı Metni" value={data.copyrightText} onChange={v => set('copyrightText', v)} dir={dir} readOnly={ro} />
    </div>
  );
}

function SeoEditor({ data, onChange, ro }: { data: HomepageSeoData; onChange: (d: HomepageSeoData) => void; dir: string; ro?: boolean }) {
  const set = (key: keyof HomepageSeoData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Meta Başlık" value={data.metaTitle} onChange={v => set('metaTitle', v)} hint="Max 60 karakter" readOnly={ro} />
      <Field name="Meta Açıklama" value={data.metaDescription} onChange={v => set('metaDescription', v)} multiline hint="Max 160 karakter" readOnly={ro} />
      <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />
      <Field name="OG Başlık" value={data.ogTitle} onChange={v => set('ogTitle', v)} readOnly={ro} />
      <Field name="OG Açıklama" value={data.ogDescription} onChange={v => set('ogDescription', v)} multiline readOnly={ro} />
      <Field name="OG Görsel URL" value={data.ogImage} onChange={v => set('ogImage', v)} hint="Paylaşılan alan" readOnly={ro} />
      <Field name="OG Görsel ALT" value={data.ogImageAlt} onChange={v => set('ogImageAlt', v)} readOnly={ro} />
      {!ro && <Checkbox name="Arama Motorlarında Göster (index)" checked={data.indexable} onChange={v => set('indexable', v)} />}
    </div>
  );
}

// ── Translation status badge ───────────────────────────────────────────────

function TxStatusBadge({ status }: { status: string }) {
  const cfg = TX_STATUS[status] ?? TX_STATUS.NOT_STARTED;
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`,
      fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── Per-locale translation info panel ────────────────────────────────────────

function TranslationInfoPanel({
  record, onRetry, onLock, onUnlock, onApprove, onPublish, onUnpublish, busy,
}: {
  record: HomepageAdminRecord;
  onRetry: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onApprove: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  busy: boolean;
}) {
  const status = record.status;
  const locked = record.isManuallyLocked;
  const lastAt = record.lastTranslatedAt;

  const btn = (label: string, onClick: () => void, variant: 'primary' | 'danger' | 'ghost' | 'gold' = 'ghost') => {
    const styles: Record<string, React.CSSProperties> = {
      primary: { background: '#2563EB', color: '#FFF', border: 'none' },
      danger:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
      ghost:   { background: '#F8FAFC', color: '#334155', border: '1px solid #CBD5E1' },
      gold:    { background: '#C79A35', color: '#102A43', border: 'none' },
    };
    return (
      <button onClick={onClick} disabled={busy} style={{
        ...styles[variant], padding: '7px 14px', borderRadius: '7px',
        fontSize: '12px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
        fontFamily: 'Inter, sans-serif', opacity: busy ? 0.7 : 1,
      }}>{label}</button>
    );
  };

  return (
    <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <TxStatusBadge status={status} />
        {locked && (
          <span style={{ fontSize: '11px', color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '999px', padding: '2px 8px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            🔒 Manuel Kilitli
          </span>
        )}
        {lastAt && (
          <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Son çeviri: {new Date(lastAt).toLocaleString('tr-TR')}
          </span>
        )}
        {record.isAiGenerated && (
          <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>• AI Çevirisi</span>
        )}
      </div>

      {/* Failure reason */}
      {status === 'FAILED' && record.failureReason && (
        <div style={{ padding: '8px 10px', background: '#FEF2F2', borderRadius: '6px', fontSize: '12px', color: '#DC2626', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>
          ⚠ {record.failureReason}
        </div>
      )}

      {/* Source changed warning */}
      {status === 'OUTDATED' && (
        <div style={{ padding: '8px 10px', background: '#FFF7ED', borderRadius: '6px', fontSize: '12px', color: '#EA580C', fontFamily: 'Inter, sans-serif', marginBottom: '10px' }}>
          ⚠ Kaynak değişti — güncelleme gerekli. Kilidi kaldırın ve yeniden çevirin.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(status === 'FAILED' || status === 'OUTDATED' || status === 'NOT_STARTED' || status === 'QUEUED') && !locked && (
          btn('🔄 Yeniden Çevir', onRetry, 'primary')
        )}
        {(status === 'OUTDATED') && locked && (
          btn('🔓 Kilidi Kaldır ve Yeniden Çevir', onUnlock, 'primary')
        )}
        {status === 'DRAFT' && btn('✓ Onayla', onApprove, 'gold')}
        {status === 'APPROVED' && btn('🚀 Yayınla', onPublish, 'primary')}
        {status === 'PUBLISHED' && btn('Yayından Kaldır', onUnpublish, 'danger')}
        {locked
          ? btn('🔓 Kilidi Kaldır', onUnlock, 'ghost')
          : btn('🔒 Manuel Kilitli Yap', onLock, 'ghost')
        }
      </div>
    </div>
  );
}

// ── Otomatik Çeviri Settings Panel ──────────────────────────────────────────

function AutoTranslatePanel({
  enabled, targetLocales, onToggle, onLocaleToggle,
}: {
  enabled: boolean;
  targetLocales: string[];
  onToggle: () => void;
  onLocaleToggle: (locale: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
      <button onClick={() => setOpen(p => !p)} style={{
        width: '100%', padding: '12px 16px', background: '#FFFFFF',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#102A43' }}>🤖 Otomatik Çeviri</span>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
            background: enabled ? '#F0FDF4' : '#F1F5F9', color: enabled ? '#16A34A' : '#64748B',
            border: `1px solid ${enabled ? '#BBF7D0' : '#CBD5E1'}`,
          }}>{enabled ? 'Etkin' : 'Devre Dışı'}</span>
        </div>
        <span style={{ color: '#64748B', fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>
            Türkçe taslak kaydedildiğinde, seçili diller otomatik olarak AI ile çevrilir.
            Çeviriler her zaman Taslak olarak kaydedilir — onay gerektirir.
          </p>
          <Checkbox name="Otomatik çeviriyi etkinleştir" checked={enabled} onChange={onToggle} />
          {enabled && (
            <div>
              <p style={{ ...lbl, marginBottom: '8px', color: '#374151' }}>Hedef Diller:</p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {LOCALES.filter(l => !l.isSource).map(l => (
                  <label key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
                    <input type="checkbox" checked={targetLocales.includes(l.code)} onChange={() => onLocaleToggle(l.code)} style={{ width: '15px', height: '15px' }} />
                    {l.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────

export default function HomepageEditor({ initialTrRecord }: { initialTrRecord: HomepageAdminRecord }) {
  const [activeLocale, setActiveLocale] = useState<string>('tr');
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [records, setRecords] = useState<Record<string, HomepageAdminRecord>>({ tr: initialTrRecord });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [localeBusy, setLocaleBusy] = useState<Record<string, boolean>>({});
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [targetLocales, setTargetLocales] = useState(['en', 'de', 'ru', 'ar']);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const currentRecord = records[activeLocale];
  const dir = LOCALES.find(l => l.code === activeLocale)?.dir ?? 'ltr';
  const isSource = activeLocale === 'tr';
  const sections: HomepageSections = currentRecord?.sections ?? (HOMEPAGE_FALLBACK[activeLocale] as HomepageSections);

  // ── Load locale ──────────────────────────────────────────────────────────
  // Use a ref to track which locales have been requested so loadLocale does not
  // depend on the `records` state value (which would recreate the callback on
  // every records update and retrigger the effect unnecessarily).
  const loadedLocales = useRef<Set<string>>(new Set(['tr']));

  const loadLocale = useCallback(async (locale: string) => {
    if (loadedLocales.current.has(locale)) return;
    loadedLocales.current.add(locale); // mark immediately to prevent parallel duplicates
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/homepage/${locale}`);
      const data = await safeJson<HomepageAdminRecord>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Yükleme başarısız.');
      setRecords(prev => ({ ...prev, [locale]: data }));
    } catch (err) {
      loadedLocales.current.delete(locale); // allow retry on next click
      setMessage({ type: 'err', text: err instanceof Error ? err.message : `${locale.toUpperCase()} içeriği yüklenemedi.` });
    } finally { setLoading(false); }
  }, []); // stable — no state deps; loadedLocales ref is always current

  // Pre-load all non-TR locale records on mount so status badges immediately
  // reflect the real DB status (PUBLISHED, APPROVED, etc.) rather than the
  // default NOT_STARTED fallback that appears before the first tab click.
  useEffect(() => {
    LOCALES.filter(l => !l.isSource).forEach(l => loadLocale(l.code as string));
  }, [loadLocale]);

  useEffect(() => { if (activeLocale !== 'tr') loadLocale(activeLocale); }, [activeLocale, loadLocale]);

  // ── Refresh a locale record from server ──────────────────────────────────
  const refreshLocale = useCallback(async (locale: string) => {
    try {
      const res = await fetch(`/admin/api/homepage/${locale}`);
      if (!res.ok) return;
      const data = await safeJson<HomepageAdminRecord>(res);
      setRecords(prev => ({ ...prev, [locale]: data }));
    } catch { /* silent — refresh failures don't block the user */ }
  }, []);

  // ── Update sections locally ──────────────────────────────────────────────
  const updateSections = (updated: HomepageSections) => {
    setRecords(prev => ({ ...prev, [activeLocale]: { ...prev[activeLocale]!, sections: updated } }));
  };
  const updateSection = <K extends keyof HomepageSections>(key: K, value: HomepageSections[K]) => {
    updateSections({ ...sections, [key]: value });
  };

  // ── Save draft (TR: + auto-translate) ────────────────────────────────────
  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);
    const isTranslating = isSource && autoTranslate && targetLocales.length > 0;
    if (isTranslating) {
      setMessage({ type: 'info', text: '⏳ Türkçe kaydediliyor ve çeviri başlatılıyor…' });
    }
    try {
      const res = await fetch(`/admin/api/homepage/${activeLocale}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections, autoTranslate: isTranslating, targetLocales }),
      });
      const data = await safeJson<{
        success: boolean; draftSaved?: boolean;
        translationJobsCreated?: number; targetLocales?: string[];
        code?: string; message?: string;
        syncResults?: Record<string, { status: string; reason?: string }>;
      }>(res);
      if (!res.ok) throw new Error(data.message ?? data.code ?? 'Kaydetme başarısız.');

      // Refresh all target locale records
      // AI_PROVIDER_NOT_CONFIGURED is a soft warning — draft IS saved, locales are QUEUED
      if (data.code === 'AI_PROVIDER_NOT_CONFIGURED') {
        setMessage({ type: 'info', text: data.message ?? 'Taslak kaydedildi. AI sağlayıcısı yapılandırılmamış.' });
        // syncResults contains the queued locales — refresh their tabs so they show QUEUED
        if (data.syncResults) {
          await Promise.all(Object.keys(data.syncResults).map(l => refreshLocale(l)));
        }
      } else if (data.syncResults) {
        const refreshPromises = Object.keys(data.syncResults).map(l => refreshLocale(l));
        await Promise.all(refreshPromises);

        const translated = Object.entries(data.syncResults).filter(([, r]) => r.status === 'translated').length;
        const failed    = Object.entries(data.syncResults).filter(([, r]) => r.status === 'failed').length;
        const skipped   = Object.entries(data.syncResults).filter(([, r]) => r.status === 'skipped').length;
        const queued    = Object.entries(data.syncResults).filter(([, r]) => r.status === 'queued').length;

        let msg = 'Türkçe taslak kaydedildi.';
        if (translated > 0) msg += ` ${translated} dil çevrildi (inceleme gerekli).`;
        if (queued > 0) msg += ` ⚠ ${queued} dil sıraya alındı — AI sağlayıcısı yapılandırılmamış.`;
        if (skipped > 0) msg += ` ${skipped} dil atlandı (değişiklik yok).`;
        if (failed > 0) msg += ` ⚠ ${failed} dilde hata — sekme detaylarını kontrol edin.`;
        setMessage({ type: failed > 0 ? 'err' : 'ok', text: msg });
      } else {
        setMessage({ type: 'ok', text: 'Taslak kaydedildi.' });
      }
      setRecords(prev => ({
        ...prev,
        [activeLocale]: { ...prev[activeLocale]!, status: prev[activeLocale]?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' },
      }));
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kaydetme hatası.' });
    } finally { setSaving(false); }
  };

  // ── Publish / Unpublish ──────────────────────────────────────────────────
  const publish = async (action: 'publish' | 'unpublish') => {
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch(`/admin/api/homepage/${activeLocale}/publish?action=${action}`, { method: 'POST' });
      const pubData = await safeJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(pubData.message ?? pubData.error ?? 'Yayın işlemi başarısız.');
      setMessage({ type: 'ok', text: action === 'publish' ? 'Yayınlandı!' : 'Yayından kaldırıldı.' });
      await refreshLocale(activeLocale);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Yayın hatası.' });
    } finally { setPublishing(false); }
  };

  // ── Bulk publish ─────────────────────────────────────────────────────────
  const bulkPublish = async () => {
    setBulkPublishing(true);
    setMessage(null);
    try {
      const res = await fetch('/admin/api/homepage/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locales: ['en', 'de', 'ru', 'ar'] }),
      });
      const data = await safeJson<{ results: Record<string, string>; error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Toplu yayın başarısız.');
      const published = Object.entries(data.results).filter(([, v]) => v === 'published').map(([k]) => k.toUpperCase());
      const skipped  = Object.entries(data.results).filter(([, v]) => v === 'skipped').map(([k]) => k.toUpperCase());
      let msg = '';
      if (published.length) msg += `Yayınlandı: ${published.join(', ')}.`;
      if (skipped.length)  msg += ` Atlandı (onaylı değil): ${skipped.join(', ')}.`;
      setMessage({ type: 'ok', text: msg || 'İşlem tamamlandı.' });
      await Promise.all(['en', 'de', 'ru', 'ar'].map(l => refreshLocale(l)));
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Toplu yayın hatası.' });
    } finally { setBulkPublishing(false); }
  };

  // ── Per-locale actions ───────────────────────────────────────────────────
  const setLocaleBusyFor = (locale: string, val: boolean) => setLocaleBusy(prev => ({ ...prev, [locale]: val }));

  const retryTranslate = async (locale: string) => {
    setLocaleBusyFor(locale, true);
    setMessage({ type: 'info', text: `⏳ ${locale.toUpperCase()} çeviriliyor…` });
    try {
      const res = await fetch(`/admin/api/homepage/${locale}/translate`, { method: 'POST' });
      const retryData = await safeJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(retryData.message ?? retryData.error ?? 'Çeviri başarısız.');
      setMessage({ type: 'ok', text: `${locale.toUpperCase()} çevirisi taslak olarak kaydedildi.` });
      await refreshLocale(locale);
    } catch (err) {
      setMessage({ type: 'err', text: `${locale.toUpperCase()} çevirisi başarısız: ${err instanceof Error ? err.message : String(err)}` });
      await refreshLocale(locale);
    } finally { setLocaleBusyFor(locale, false); }
  };

  const toggleLock = async (locale: string, lock: boolean) => {
    setLocaleBusyFor(locale, true);
    try {
      const res = await fetch(`/admin/api/homepage/${locale}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: lock }),
      });
      const lockData = await safeJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(lockData.message ?? lockData.error ?? 'Kilit değiştirilemedi.');
      setMessage({ type: 'ok', text: lock ? `${locale.toUpperCase()} kilitlendi.` : `${locale.toUpperCase()} kilidi kaldırıldı.` });
      await refreshLocale(locale);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kilit hatası.' });
    } finally { setLocaleBusyFor(locale, false); }
  };

  const approveTranslation = async (locale: string) => {
    setLocaleBusyFor(locale, true);
    try {
      const res = await fetch(`/admin/api/homepage/${locale}/publish?action=approve`, { method: 'POST' });
      const approveData = await safeJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(approveData.message ?? approveData.error ?? 'Onaylama başarısız.');
      setMessage({ type: 'ok', text: `${locale.toUpperCase()} onaylandı.` });
      await refreshLocale(locale);
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Onay hatası.' });
    } finally { setLocaleBusyFor(locale, false); }
  };

  const toggleLocale = (lc: string) => {
    setTargetLocales(prev => prev.includes(lc) ? prev.filter(x => x !== lc) : [...prev, lc]);
  };

  const statusForLocale = (code: string) => {
    if (code === 'tr') return records.tr?.status ?? 'DRAFT';
    return records[code]?.status ?? 'NOT_STARTED';
  };

  // Sections render helper (isSource=true → show editable; false → read-only)
  const renderSection = () => {
    const ro = !isSource; // Non-TR tabs show read-only AI-translated content
    switch (activeSection) {
      case 'hero':        return <HeroEditor data={sections.hero} onChange={d => updateSection('hero', d)} dir={dir} ro={ro} />;
      case 'heroStats':   return <StatsEditor data={sections.heroStats} onChange={d => updateSection('heroStats', d)} dir={dir} ro={ro} />;
      case 'services':    return <ServicesSectionEditor data={sections.servicesSection} onChange={d => updateSection('servicesSection', d)} dir={dir} ro={ro} />;
      case 'trust':       return <TrustEditor data={sections.trustSection} onChange={d => updateSection('trustSection', d)} dir={dir} ro={ro} />;
      case 'vehicles':    return <VehiclesEditor data={sections.vehiclesSection} onChange={d => updateSection('vehiclesSection', d)} dir={dir} ro={ro} />;
      case 'reviews':     return <ReviewsSectionEditor data={sections.reviewsSection} onChange={d => updateSection('reviewsSection', d)} dir={dir} ro={ro} />;
      case 'reservation': return <ReservationEditor data={sections.reservationSection} onChange={d => updateSection('reservationSection', d)} dir={dir} ro={ro} />;
      case 'contact':     return <ContactEditor data={sections.contactSection} onChange={d => updateSection('contactSection', d)} dir={dir} ro={ro} />;
      case 'footer':      return <FooterEditor data={sections.footerSection} onChange={d => updateSection('footerSection', d)} dir={dir} ro={ro} />;
      case 'seo':         return <SeoEditor data={sections.seo} onChange={d => updateSection('seo', d)} dir={dir} ro={ro} />;
      default: return null;
    }
  };

  // Toast colors
  const toastBg: Record<string, string> = { ok: '#F0FDF4', err: '#FEF2F2', info: '#EFF6FF' };
  const toastColor: Record<string, string> = { ok: '#16A34A', err: '#DC2626', info: '#2563EB' };
  const toastBorder: Record<string, string> = { ok: '#BBF7D0', err: '#FECACA', info: '#BFDBFE' };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── Responsive CSS ─────────────────────────────────────────────────── */}
      <style>{`
        .hpe-grid { display: grid; grid-template-columns: 190px 1fr; gap: 18px; }
        .hpe-fg2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .hpe-fg3  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .hpe-sec-desktop { display: block; }
        .hpe-sec-mobile  { display: none; }
        .hpe-abar {
          margin-top: 18px; padding: 14px 18px;
          background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .hpe-ml-auto { margin-left: auto; }
        @media (max-width: 767px) {
          .hpe-grid { grid-template-columns: 1fr; gap: 12px; }
          .hpe-fg2, .hpe-fg3 { grid-template-columns: 1fr; }
          .hpe-sec-desktop { display: none !important; }
          .hpe-sec-mobile  { display: block !important; }
          .hpe-abar { flex-direction: column; align-items: stretch; }
          .hpe-abar button, .hpe-abar a {
            width: 100%; box-sizing: border-box; text-align: center;
            min-height: 44px; display: flex; align-items: center; justify-content: center;
          }
          .hpe-ml-auto { margin-left: 0; margin-top: 4px; }
        }
      `}</style>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#102A43', margin: 0 }}>Ana Sayfa Düzenleyici</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Türkçe kaynak · Otomatik çok dilli senkronizasyon · AI çevirisi
          </p>
        </div>
        <TxStatusBadge status={statusForLocale(activeLocale)} />
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', fontWeight: 500,
          background: toastBg[message.type], color: toastColor[message.type], border: `1px solid ${toastBorder[message.type]}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, color: 'inherit', padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Auto-translate settings — only shown on TR tab */}
      {isSource && (
        <AutoTranslatePanel
          enabled={autoTranslate}
          targetLocales={targetLocales}
          onToggle={() => setAutoTranslate(p => !p)}
          onLocaleToggle={toggleLocale}
        />
      )}

      {/* Locale tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {LOCALES.map(l => {
          const s = statusForLocale(l.code);
          const isActive = activeLocale === l.code;
          const locked = records[l.code]?.isManuallyLocked ?? false;
          return (
            <button key={l.code} onClick={() => setActiveLocale(l.code)}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                border: `2px solid ${isActive ? '#2563EB' : '#E2E8F0'}`,
                background: isActive ? '#EFF6FF' : '#FFFFFF',
                color: isActive ? '#2563EB' : '#374151',
                fontSize: '12px', fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              }}>
              <span>{l.label} {locked ? '🔒' : ''}</span>
              <TxStatusBadge status={s} />
            </button>
          );
        })}
      </div>

      {/* Per-locale translation panel (not TR) */}
      {!isSource && currentRecord && (
        <TranslationInfoPanel
          record={currentRecord}
          onRetry={() => retryTranslate(activeLocale)}
          onLock={() => toggleLock(activeLocale, true)}
          onUnlock={() => toggleLock(activeLocale, false)}
          onApprove={() => approveTranslation(activeLocale)}
          onPublish={() => publish('publish')}
          onUnpublish={() => publish('unpublish')}
          busy={!!localeBusy[activeLocale]}
        />
      )}

      {/* Two-column layout: section nav + content */}
      <div className="hpe-grid" style={{ alignItems: 'start' }}>
        {/* Section nav — desktop list + mobile dropdown */}
        <div>
          {/* Mobile dropdown (hidden on desktop) */}
          <select
            className="hpe-sec-mobile"
            value={activeSection}
            onChange={e => setActiveSection(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB',
              borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
              color: '#374151', background: '#fff', boxSizing: 'border-box', marginBottom: '12px',
            }}
          >
            {SECTIONS.map(sec => (
              <option key={sec.key} value={sec.key}>{sec.label}</option>
            ))}
          </select>

          {/* Desktop vertical nav (hidden on mobile) */}
          <div className="hpe-sec-desktop" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
            {SECTIONS.map(sec => (
              <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: activeSection === sec.key ? '#EFF6FF' : 'transparent',
                  color: activeSection === sec.key ? '#2563EB' : '#374151',
                  fontSize: '12px', fontWeight: activeSection === sec.key ? 700 : 500,
                  border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>
                {sec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section editor */}
        <div dir={dir} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '22px', boxSizing: 'border-box', minWidth: 0 }}>
          {!isSource && (
            <div style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: '7px', marginBottom: '16px', fontSize: '12px', color: '#2563EB', fontFamily: 'Inter, sans-serif', border: '1px solid #BFDBFE' }}>
              ℹ Çevrilmiş içerik — salt okunur. Düzenlemek için Türkçe kaynağı değiştirin veya &quot;Manuel düzenleme&quot; moduna geçin.
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '14px' }}>Yükleniyor…</div>
          ) : renderSection()}
        </div>
      </div>

      {/* Action bar */}
      <div className="hpe-abar">
        {/* Primary save button */}
        {isSource && (
          <button onClick={saveDraft} disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              background: '#C79A35', border: 'none', color: '#102A43',
              fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1, fontFamily: 'Inter, sans-serif',
            }}>
            {saving ? '⏳ İşleniyor…' : (autoTranslate && targetLocales.length > 0 ? '💾 Taslak Kaydet ve Çevir' : '💾 Taslak Kaydet')}
          </button>
        )}

        {/* Publish / Unpublish current locale */}
        {currentRecord?.status === 'APPROVED' && (
          <button onClick={() => publish('publish')} disabled={publishing}
            style={{ padding: '9px 18px', borderRadius: '8px', background: '#16A34A', border: 'none', color: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: publishing ? 0.7 : 1 }}>
            🚀 Yayınla
          </button>
        )}
        {currentRecord?.status === 'PUBLISHED' && (
          <button onClick={() => publish('unpublish')} disabled={publishing}
            style={{ padding: '9px 18px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Yayından Kaldır
          </button>
        )}

        {/* Review all translations */}
        <Link href="/admin/ceviriler" style={{
          padding: '9px 18px', borderRadius: '8px', background: '#F8FAFC',
          border: '1px solid #CBD5E1', color: '#334155',
          fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          fontFamily: 'Inter, sans-serif',
        }}>
          🔍 Tüm Çevirileri İncele
        </Link>

        {/* Bulk publish approved */}
        <button onClick={bulkPublish} disabled={bulkPublishing}
          style={{
            padding: '9px 18px', borderRadius: '8px', background: '#F8FAFC',
            border: '1px solid #CBD5E1', color: '#334155',
            fontSize: '13px', fontWeight: 600, cursor: bulkPublishing ? 'wait' : 'pointer',
            opacity: bulkPublishing ? 0.7 : 1, fontFamily: 'Inter, sans-serif',
          }}>
          {bulkPublishing ? '⏳…' : '📦 Onaylanan Dilleri Toplu Yayınla'}
        </button>

        <span className="hpe-ml-auto" style={{ fontSize: '11px', color: '#94A3B8' }}>
          {currentRecord?.updatedAt ? `Son güncelleme: ${new Date(currentRecord.updatedAt).toLocaleString('tr-TR')}` : '—'}
        </span>
      </div>
    </div>
  );
}
