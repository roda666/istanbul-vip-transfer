'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HomepageAdminRecord } from '@/lib/homepage-cms';
import type { HomepageSections, HeroSection, HeroStat, ServicesSectionData, TrustSectionData, VehiclesSectionData, ReviewsSectionData, ReservationSectionData, ContactSectionData, FooterSectionData, HomepageSeoData } from '@/lib/homepage-types';
import { HOMEPAGE_FALLBACK } from '@/lib/homepage-types';

// ── Constants ──────────────────────────────────────────────────────────────

const LOCALES = [
  { code: 'tr', label: 'TR 🇹🇷', dir: 'ltr' },
  { code: 'en', label: 'EN 🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'DE 🇩🇪', dir: 'ltr' },
  { code: 'ru', label: 'RU 🇷🇺', dir: 'ltr' },
  { code: 'ar', label: 'AR 🇸🇦', dir: 'rtl' },
] as const;

const SECTIONS = [
  { key: 'hero',        label: 'A · Hero' },
  { key: 'heroStats',   label: 'B · İstatistikler' },
  { key: 'services',    label: 'C · Hizmetler Bölümü' },
  { key: 'trust',       label: 'D · Güven Kartları' },
  { key: 'vehicles',    label: 'E · Araçlar Bölümü' },
  { key: 'reviews',     label: 'F · Google Yorumları' },
  { key: 'reservation', label: 'G · Rezervasyon Bölümü' },
  { key: 'contact',     label: 'H · İletişim Bölümü' },
  { key: 'footer',      label: 'I · Footer' },
  { key: 'seo',         label: 'J · SEO' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Taslak', REVIEW: 'İncelemede', APPROVED: 'Onaylandı',
  SCHEDULED: 'Planlandı', PUBLISHED: 'Yayında', ARCHIVED: 'Arşiv',
  NOT_STARTED: 'Başlanmadı', TRANSLATING: 'Çevriliyor', FAILED: 'Hatalı', OUTDATED: 'Eski',
};
const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: '#16A34A', APPROVED: '#2563EB', REVIEW: '#D97706',
  DRAFT: '#64748B', NOT_STARTED: '#94A3B8', FAILED: '#DC2626',
};

// ── Shared input style ─────────────────────────────────────────────────────

const inp = (dir?: string): React.CSSProperties => ({
  width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB',
  borderRadius: '6px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
  color: '#1E293B', background: '#FFFFFF', boxSizing: 'border-box', direction: dir as React.CSSProperties['direction'],
});
const ta = (dir?: string, rows = 3): React.CSSProperties => ({ ...inp(dir), resize: 'vertical', minHeight: `${rows * 22 + 16}px` });
const label: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', marginBottom: '4px', display: 'block' };

// ── Field helpers ──────────────────────────────────────────────────────────

function Field({ name, value, onChange, multiline, rows, dir, hint }: {
  name: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number; dir?: string; hint?: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={label}>{name}</label>
      {multiline
        ? <textarea style={ta(dir, rows)} value={value} onChange={e => onChange(e.target.value)} dir={dir} />
        : <input style={inp(dir)} value={value} onChange={e => onChange(e.target.value)} dir={dir} />
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

function HeroEditor({ data, onChange, dir }: { data: HeroSection; onChange: (d: HeroSection) => void; dir: string }) {
  const set = (key: keyof HeroSection, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <Field name="Badge / Rozet" value={data.badge} onChange={v => set('badge', v)} dir={dir} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field name="Başlık 1" value={data.headline1} onChange={v => set('headline1', v)} dir={dir} />
        <Field name="Vurgulanan Kelime" value={data.headlineAccent} onChange={v => set('headlineAccent', v)} dir={dir} />
      </div>
      <Field name="Başlık 2" value={data.headline2} onChange={v => set('headline2', v)} dir={dir} />
      <Field name="Alt Başlık" value={data.subheadline} onChange={v => set('subheadline', v)} multiline rows={3} dir={dir} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field name="CTA Rezervasyon Metni" value={data.ctaBookingText} onChange={v => set('ctaBookingText', v)} dir={dir} />
        <Field name="CTA Ara Metni" value={data.ctaCallText} onChange={v => set('ctaCallText', v)} dir={dir} />
      </div>
      <Field name="Hero Görseli Yolu" value={data.imagePath} onChange={v => set('imagePath', v)} hint="Örn: /images/istanbul-vip-transfer-hero.webp veya tam URL" />
      <Field name="Görsel ALT Metni" value={data.imageAlt} onChange={v => set('imageAlt', v)} dir={dir} />
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function StatsEditor({ data, onChange, dir }: { data: HeroStat[]; onChange: (d: HeroStat[]) => void; dir: string }) {
  const set = (i: number, key: keyof HeroStat, val: string | boolean | number) => {
    const next = [...data];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Sayı metinleri (IST &amp; SAW, 7/24, Vito &amp; Sprinter) teknik değerlerdir — dirección LTR sabit kalır. Sadece etiket (label) çevrilir.
      </p>
      {data.map((stat, i) => (
        <div key={stat.key} style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '12px', background: '#F8FAFC' }}>
          <p style={{ ...label, marginBottom: '10px', color: '#C79A35' }}>{stat.key.toUpperCase()} — {stat.numberText}</p>
          <Field name="Etiket (çeviri)" value={stat.label} onChange={v => set(i, 'label', v)} dir={dir} />
          <Checkbox name="Etkin" checked={stat.enabled} onChange={v => set(i, 'enabled', v)} />
        </div>
      ))}
    </div>
  );
}

function ServicesSectionEditor({ data, onChange, dir }: { data: ServicesSectionData; onChange: (d: ServicesSectionData) => void; dir: string }) {
  const set = (key: keyof ServicesSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Servis kartları (başlık, açıklama, rota) Hizmetler modülünden gelir. Burada yalnızca bölüm başlığı ve buton yönetilir.
      </p>
      <Field name="Üst Etiket (Eyebrow)" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field name="Tüm Hizmetler Buton Metni" value={data.allServicesText} onChange={v => set('allServicesText', v)} dir={dir} />
        <Field name="Tüm Hizmetler Yolu" value={data.allServicesRoute} onChange={v => set('allServicesRoute', v)} />
      </div>
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function TrustEditor({ data, onChange, dir }: { data: TrustSectionData; onChange: (d: TrustSectionData) => void; dir: string }) {
  const set = (key: 'eyebrow' | 'heading' | 'enabled', val: string | boolean) => onChange({ ...data, [key]: val });
  const setCard = (i: number, key: string, val: string | boolean) => {
    const cards = [...data.cards];
    cards[i] = { ...cards[i], [key]: val };
    onChange({ ...data, cards });
  };
  return (
    <div>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
      <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />
      <p style={{ ...label, color: '#C79A35', marginBottom: '12px' }}>Güven Kartları</p>
      {data.cards.map((card, i) => (
        <div key={card.id} style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '12px', background: '#F8FAFC' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
            <Field name={`Kart ${i + 1} Başlık`} value={card.title} onChange={v => setCard(i, 'title', v)} dir={dir} />
            <div style={{ paddingTop: '20px' }}><Checkbox name="Etkin" checked={card.enabled} onChange={v => setCard(i, 'enabled', v)} /></div>
          </div>
          <Field name="Açıklama" value={card.description} onChange={v => setCard(i, 'description', v)} multiline rows={2} dir={dir} />
        </div>
      ))}
    </div>
  );
}

function VehiclesEditor({ data, onChange, dir }: { data: VehiclesSectionData; onChange: (d: VehiclesSectionData) => void; dir: string }) {
  const set = (key: keyof VehiclesSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Araç adı, açıklama ve görseli Araçlar modülünden gelir. Burada yalnızca bölüm başlığı yönetilir.
      </p>
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field name="Buton Metni" value={data.ctaText} onChange={v => set('ctaText', v)} dir={dir} />
        <Field name="Buton Yolu" value={data.ctaRoute} onChange={v => set('ctaRoute', v)} />
      </div>
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function ReviewsSectionEditor({ data, onChange, dir }: { data: ReviewsSectionData; onChange: (d: ReviewsSectionData) => void; dir: string }) {
  const set = (key: keyof ReviewsSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Yorum içerikleri Google Yorumları modülünde yönetilir. Burada bölüm başlıkları düzenlenir.
      </p>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} />
      <Field name="Bölüm Başlığı" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Field name="Tüm Yorumlar Buton Metni" value={data.viewAllText} onChange={v => set('viewAllText', v)} dir={dir} />
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function ReservationEditor({ data, onChange, dir }: { data: ReservationSectionData; onChange: (d: ReservationSectionData) => void; dir: string }) {
  const set = (key: keyof ReservationSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Rezervasyon formu iş mantığı değiştirilemez. Yalnızca bölüm sunum içeriği yönetilir.
      </p>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} />
      <Field name="Başlık" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Field name="Açıklama" value={data.description} onChange={v => set('description', v)} multiline dir={dir} />
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function ContactEditor({ data, onChange, dir }: { data: ContactSectionData; onChange: (d: ContactSectionData) => void; dir: string }) {
  const set = (key: keyof ContactSectionData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Telefon, WhatsApp ve e-posta Site Ayarları modülünden alınır.
      </p>
      <Field name="Üst Etiket" value={data.eyebrow} onChange={v => set('eyebrow', v)} dir={dir} />
      <Field name="Başlık" value={data.heading} onChange={v => set('heading', v)} dir={dir} />
      <Field name="Alt Başlık" value={data.subheading} onChange={v => set('subheading', v)} multiline dir={dir} />
      <Field name="WhatsApp Buton Metni" value={data.whatsappCtaText} onChange={v => set('whatsappCtaText', v)} dir={dir} />
      <Checkbox name="Bölüm Etkin" checked={data.enabled} onChange={v => set('enabled', v)} />
    </div>
  );
}

function FooterEditor({ data, onChange, dir }: { data: FooterSectionData; onChange: (d: FooterSectionData) => void; dir: string }) {
  const set = (key: keyof FooterSectionData, val: string) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Menü ve iletişim bilgileri kendi modüllerinden alınır.
      </p>
      <Field name="Marka Sloganı (kısa)" value={data.premiumTagline} onChange={v => set('premiumTagline', v)} dir={dir} />
      <Field name="Alt Satır Açıklama" value={data.tagline} onChange={v => set('tagline', v)} multiline dir={dir} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <Field name="Sütun 1 Başlığı" value={data.col1Heading} onChange={v => set('col1Heading', v)} dir={dir} />
        <Field name="Sütun 2 Başlığı" value={data.col2Heading} onChange={v => set('col2Heading', v)} dir={dir} />
        <Field name="Sütun 3 Başlığı" value={data.col3Heading} onChange={v => set('col3Heading', v)} dir={dir} />
      </div>
      <Field name="Telif Hakkı Metni" value={data.copyrightText} onChange={v => set('copyrightText', v)} dir={dir} />
    </div>
  );
}

function SeoEditor({ data, onChange }: { data: HomepageSeoData; onChange: (d: HomepageSeoData) => void; dir: string }) {
  const set = (key: keyof HomepageSeoData, val: string | boolean) => onChange({ ...data, [key]: val });
  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
        Canonical ve hreflang URL&apos;leri otomatik oluşturulur — bu alanda belirtilen canonical URL&apos;ye izin verilmez.
      </p>
      <Field name="Meta Başlık" value={data.metaTitle} onChange={v => set('metaTitle', v)} hint="Max 60 karakter" />
      <Field name="Meta Açıklama" value={data.metaDescription} onChange={v => set('metaDescription', v)} multiline hint="Max 160 karakter" />
      <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />
      <Field name="OG Başlık" value={data.ogTitle} onChange={v => set('ogTitle', v)} />
      <Field name="OG Açıklama" value={data.ogDescription} onChange={v => set('ogDescription', v)} multiline />
      <Field name="OG Görsel URL" value={data.ogImage} onChange={v => set('ogImage', v)} />
      <Field name="OG Görsel ALT" value={data.ogImageAlt} onChange={v => set('ogImageAlt', v)} />
      <Checkbox name="Arama Motorlarında Göster (index)" checked={data.indexable} onChange={v => set('indexable', v)} />
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
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const currentRecord = records[activeLocale];
  const dir = LOCALES.find(l => l.code === activeLocale)?.dir ?? 'ltr';

  // Current sections (with fallback)
  const sections: HomepageSections = currentRecord?.sections ?? (HOMEPAGE_FALLBACK[activeLocale] as HomepageSections);

  // ── Load locale data ─────────────────────────────────────────────────────
  const loadLocale = useCallback(async (locale: string) => {
    if (records[locale]) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/homepage/${locale}`);
      if (!res.ok) throw new Error('Load failed');
      const data: HomepageAdminRecord = await res.json();
      setRecords(prev => ({ ...prev, [locale]: data }));
    } catch {
      setMessage({ type: 'err', text: `${locale.toUpperCase()} içeriği yüklenemedi.` });
    } finally {
      setLoading(false);
    }
  }, [records]);

  useEffect(() => {
    if (activeLocale !== 'tr') loadLocale(activeLocale);
  }, [activeLocale, loadLocale]);

  // ── Update sections locally ───────────────────────────────────────────────
  const updateSections = (updated: HomepageSections) => {
    setRecords(prev => ({
      ...prev,
      [activeLocale]: {
        ...prev[activeLocale]!,
        sections: updated,
      },
    }));
  };

  const updateSection = <K extends keyof HomepageSections>(key: K, value: HomepageSections[K]) => {
    updateSections({ ...sections, [key]: value });
  };

  // ── Save draft ────────────────────────────────────────────────────────────
  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/admin/api/homepage/${activeLocale}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setMessage({ type: 'ok', text: 'Taslak kaydedildi.' });
      // Refresh record
      setRecords(prev => ({
        ...prev,
        [activeLocale]: { ...prev[activeLocale]!, status: prev[activeLocale]?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' },
      }));
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Kaydetme hatası.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const publish = async (action: 'publish' | 'unpublish') => {
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch(`/admin/api/homepage/${activeLocale}/publish?action=${action}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Publish failed');
      const label = action === 'publish' ? 'Yayınlandı! Sayfa güncellendi.' : 'Yayından kaldırıldı.';
      setMessage({ type: 'ok', text: label });
      setRecords(prev => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale]!,
          status: action === 'publish' ? 'PUBLISHED' : 'DRAFT',
          publishedAt: action === 'publish' ? new Date() : null,
        },
      }));
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Yayın hatası.' });
    } finally {
      setPublishing(false);
    }
  };

  const status = currentRecord?.status ?? '—';
  const statusColor = STATUS_COLOR[status] ?? '#94A3B8';
  const isPublished = status === 'PUBLISHED';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#102A43', margin: 0 }}>Ana Sayfa Düzenleyici</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>CMS Phase 1 — Tüm bölümleri yönetin, taslak kaydedin ve yayınlayın.</p>
        </div>
        {/* Status badge */}
        <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44` }}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {/* Toast message */}
      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 500, background: message.type === 'ok' ? '#F0FDF4' : '#FEF2F2', color: message.type === 'ok' ? '#16A34A' : '#DC2626', border: `1px solid ${message.type === 'ok' ? '#BBF7D0' : '#FECACA'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, color: 'inherit', padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Locale tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {LOCALES.map(l => {
          const rec = records[l.code];
          const s = rec?.status ?? (l.code === 'tr' ? 'DRAFT' : 'NOT_STARTED');
          const sc = STATUS_COLOR[s] ?? '#94A3B8';
          const isActive = activeLocale === l.code;
          return (
            <button key={l.code} onClick={() => setActiveLocale(l.code)}
              style={{ padding: '7px 14px', borderRadius: '8px', border: `2px solid ${isActive ? '#2563EB' : '#E2E8F0'}`, background: isActive ? '#EFF6FF' : '#FFFFFF', color: isActive ? '#2563EB' : '#374151', fontSize: '13px', fontWeight: isActive ? 700 : 500, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              {l.label}
              <span style={{ fontSize: '9px', fontWeight: 600, color: sc }}>{STATUS_LABEL[s] ?? s}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Section nav */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          {SECTIONS.map(sec => (
            <button key={sec.key} onClick={() => setActiveSection(sec.key)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: activeSection === sec.key ? '#EFF6FF' : 'transparent', color: activeSection === sec.key ? '#2563EB' : '#374151', fontSize: '12px', fontWeight: activeSection === sec.key ? 700 : 500, border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {sec.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '14px' }}>Yükleniyor…</div>
          ) : (
            <>
              {activeSection === 'hero'        && <HeroEditor data={sections.hero} onChange={d => updateSection('hero', d)} dir={dir} />}
              {activeSection === 'heroStats'   && <StatsEditor data={sections.heroStats} onChange={d => updateSection('heroStats', d)} dir={dir} />}
              {activeSection === 'services'    && <ServicesSectionEditor data={sections.servicesSection} onChange={d => updateSection('servicesSection', d)} dir={dir} />}
              {activeSection === 'trust'       && <TrustEditor data={sections.trustSection} onChange={d => updateSection('trustSection', d)} dir={dir} />}
              {activeSection === 'vehicles'    && <VehiclesEditor data={sections.vehiclesSection} onChange={d => updateSection('vehiclesSection', d)} dir={dir} />}
              {activeSection === 'reviews'     && <ReviewsSectionEditor data={sections.reviewsSection} onChange={d => updateSection('reviewsSection', d)} dir={dir} />}
              {activeSection === 'reservation' && <ReservationEditor data={sections.reservationSection} onChange={d => updateSection('reservationSection', d)} dir={dir} />}
              {activeSection === 'contact'     && <ContactEditor data={sections.contactSection} onChange={d => updateSection('contactSection', d)} dir={dir} />}
              {activeSection === 'footer'      && <FooterEditor data={sections.footerSection} onChange={d => updateSection('footerSection', d)} dir={dir} />}
              {activeSection === 'seo'         && <SeoEditor data={sections.seo} onChange={d => updateSection('seo', d)} dir={dir} />}
            </>
          )}
        </div>
      </div>

      {/* Workflow action bar */}
      <div style={{ marginTop: '20px', padding: '16px 20px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={saveDraft} disabled={saving || loading}
          style={{ padding: '9px 18px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Kaydediliyor…' : '💾 Taslak Kaydet'}
        </button>
        <button onClick={() => publish('publish')} disabled={publishing || loading}
          style={{ padding: '9px 18px', borderRadius: '8px', background: '#16A34A', border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: publishing ? 'wait' : 'pointer', opacity: publishing ? 0.7 : 1 }}>
          {publishing ? 'İşleniyor…' : '🚀 Yayınla'}
        </button>
        {isPublished && (
          <button onClick={() => publish('unpublish')} disabled={publishing || loading}
            style={{ padding: '9px 18px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', fontWeight: 600, cursor: publishing ? 'wait' : 'pointer', opacity: publishing ? 0.7 : 1 }}>
            Yayından Kaldır
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94A3B8' }}>
          {currentRecord?.updatedAt ? `Son güncelleme: ${new Date(currentRecord.updatedAt).toLocaleString('tr-TR')}` : '—'}
        </span>
      </div>
    </div>
  );
}
