'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, X, Check, Loader2, MapPinned } from 'lucide-react';
import type {
  RouteFaqItem,
  RouteTransportOption,
  TransferRoute,
  TransferRouteTranslation,
} from '@/db/schema';
import { AISeoGenerator } from '@/app/admin/_components/AISeoGenerator';
import { AdminRecordActions } from '@/app/admin/_components/AdminRecordActions';
import { groupManagedLocationOptions, type ManagedLocationOption } from '@/lib/admin-location-options';

// ── Design tokens ────────────────────────────────────────────────────────────
const BORDER = '#D8E1E9';
const TEXT    = '#172B3A';
const MUTED   = '#718596';
const BG      = '#FFFFFF';

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: '6px',
  color: TEXT, fontSize: '13px', fontFamily: 'Inter, sans-serif',
  padding: '10px 12px', minHeight: '44px', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const btnStyleDelete: React.CSSProperties = { border: '1px solid #FECACA', borderRadius: '6px', color: '#D64545', background: '#FFF', padding: '0 16px', minHeight: '44px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' };
const btnStyleAdd: React.CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#2563EB', background: '#FFF', padding: '0 16px', minHeight: '44px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 };

// ── Empty form ───────────────────────────────────────────────────────────────
const EMPTY: Partial<TransferRoute> = {
  name: '', origin: '', destination: '',
  distanceKm: 0, durationMinutes: 0,
  normalDurationMinMinutes: null, normalDurationMaxMinutes: null,
  peakDurationMinMinutes: null, peakDurationMaxMinutes: null,
  hasCrossContinentPassage: false,
  priceVitoMinEur: 0, priceVitoMaxEur: 0,
  priceSprinterMinEur: 0, priceSprinterMaxEur: 0,
  imagePath: '', displayOrder: 0, active: true, description: '', seoTitle: '', seoDescription: '',
  ogTitle: '', ogDescription: '', relatedServiceSlug: 'vip-transfer', indexable: true,
  introParagraph: '', transportOptions: [], routeNotes: [], faqItems: [],
};

type RouteTranslationDraft = Pick<TransferRouteTranslation,
  'languageCode' | 'title' | 'description' | 'seoTitle' | 'seoDescription' | 'ogTitle' | 'ogDescription' |
  'introParagraph' | 'transportOptions' | 'routeNotes' | 'faqItems' | 'status' | 'isManuallyLocked'>;
type AdminRoute = TransferRoute & { translations: RouteTranslationDraft[] };
type RouteDraft = Partial<TransferRoute> & { translations?: RouteTranslationDraft[], imageAlt?: string | null };
type ManagedLocation = ManagedLocationOption;
type ManagedVehicle = { id: string; name: string; priceCalculationEligible: boolean };

const LOCALES = [
  ['en', 'English'], ['de', 'Deutsch'], ['ru', 'Русский'], ['ar', 'العربية'],
  ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['nl', 'Nederlands'],
] as const;

type RouteContentDraft = {
  introParagraph?: string | null;
  transportOptions?: RouteTransportOption[];
  routeNotes?: string[];
  faqItems?: RouteFaqItem[];
};

const REQUEST_TIMEOUT_MS = 45_000;

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonRecord(parsed) ? parsed : {};
  } catch {
    if (!response.ok) return {};
    throw new Error('Sunucudan geçersiz JSON yanıtı alındı.');
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function responseError(payload: Record<string, unknown>, fallback: string): string {
  return typeof payload.error === 'string' ? payload.error : fallback;
}

function RouteContentFields({
  value,
  onChange,
  locale,
}: {
  value: RouteContentDraft;
  onChange: (patch: Partial<RouteContentDraft>) => void;
  locale: string;
}) {
  const transportOptions = value.transportOptions ?? [];
  const routeNotes = value.routeNotes ?? [];
  const faqItems = value.faqItems ?? [];
  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  const updateTransport = (index: number, key: keyof RouteTransportOption, next: string) => {
    const items = transportOptions.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: next } : item);
    onChange({ transportOptions: items });
  };
  const updateFaq = (index: number, key: keyof RouteFaqItem, next: string) => {
    const items = faqItems.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: next } : item);
    onChange({ faqItems: items });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: '#F8FAFC' }}>
      <div>
        <label style={labelStyle}>Doğrudan Cevap Paragrafı</label>
        <textarea
          dir={direction}
          style={{ ...inputStyle, minHeight: '92px', resize: 'vertical' }}
          value={value.introParagraph ?? ''}
          placeholder="İlk cümlede yaklaşık mesafe ve süreyi doğrudan söyleyin."
          onChange={(event) => onChange({ introParagraph: event.target.value })}
        />
      </div>

      <div>
        <label style={labelStyle}>Ulaşım Seçenekleri (ucuzdan pahalıya)</label>
        <p style={{ margin: '0 0 12px', color: MUTED, fontSize: '11px', lineHeight: 1.45 }}>Her seçenekte avantajın yanında dürüst bir dezavantaj yazın. Özel transferi son sıraya ekleyin.</p>
        {transportOptions.map((option, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px', border: `1px solid ${BORDER}`, padding: '16px', borderRadius: '8px', background: '#FFF' }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => onChange({ transportOptions: transportOptions.filter((_, itemIndex) => itemIndex !== index) })} style={btnStyleDelete}>Sil</button>
            </div>
            <div>
              <label style={labelStyle}>Seçenek</label>
              <input dir={direction} style={inputStyle} value={option.name} placeholder="Seçenek" onChange={(event) => updateTransport(index, 'name', event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Kısa Açıklama</label>
              <input dir={direction} style={inputStyle} value={option.summary} placeholder="Kısa açıklama" onChange={(event) => updateTransport(index, 'summary', event.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Dürüst Dezavantaj</label>
              <textarea dir={direction} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} value={option.downside} placeholder="Dürüst dezavantaj" onChange={(event) => updateTransport(index, 'downside', event.target.value)} />
            </div>
          </div>
        ))}
        {transportOptions.length < 8 && <button type="button" onClick={() => onChange({ transportOptions: [...transportOptions, { name: '', summary: '', downside: '' }] })} style={btnStyleAdd}>+ Ulaşım seçeneği ekle</button>}
      </div>

      <div>
        <label style={labelStyle}>Güzergâh ve Trafik Notları</label>
        {routeNotes.map((note, index) => (
          <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input dir={direction} style={{ ...inputStyle, flex: '1 1 200px' }} value={note} placeholder="Örn: Akşam saatlerinde TEM bağlantılarında yoğunluk görülebilir." onChange={(event) => onChange({ routeNotes: routeNotes.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} />
            <button type="button" onClick={() => onChange({ routeNotes: routeNotes.filter((_, itemIndex) => itemIndex !== index) })} style={{ ...btnStyleDelete, flex: '0 0 auto' }}>Sil</button>
          </div>
        ))}
        {routeNotes.length < 12 && <button type="button" onClick={() => onChange({ routeNotes: [...routeNotes, ''] })} style={btnStyleAdd}>+ Not ekle</button>}
      </div>

      <div>
        <label style={labelStyle}>Sık Sorulan Sorular</label>
        <p style={{ margin: '0 0 12px', color: MUTED, fontSize: '11px', lineHeight: 1.45 }}>Yayımlanan rota sayfaları için en az beş soru ve cevap girin; her cevap ilk cümlede doğrudan cevap vermelidir.</p>
        {faqItems.map((faq, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', border: `1px solid ${BORDER}`, padding: '16px', borderRadius: '8px', background: '#FFF' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Soru</label>
                <input dir={direction} style={inputStyle} value={faq.question} placeholder="Soru" onChange={(event) => updateFaq(index, 'question', event.target.value)} />
              </div>
              <div style={{ marginTop: '19px', flex: '0 0 auto' }}>
                <button type="button" onClick={() => onChange({ faqItems: faqItems.filter((_, itemIndex) => itemIndex !== index) })} style={btnStyleDelete}>Sil</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cevap</label>
              <textarea dir={direction} style={{ ...inputStyle, minHeight: '94px', resize: 'vertical' }} value={faq.answer} placeholder="Cevap (40–70 kelime)" onChange={(event) => updateFaq(index, 'answer', event.target.value)} />
            </div>
          </div>
        ))}
        {faqItems.length < 12 && <button type="button" onClick={() => onChange({ faqItems: [...faqItems, { question: '', answer: '' }] })} style={btnStyleAdd}>+ SSS ekle</button>}
      </div>
    </div>
  );
}

// ── Route Image Editor ────────────────────────────────────────────────────────
function RouteImageEditor({ imagePath, imageAlt, onImageChange, onImageCreated, form }: { imagePath: string; imageAlt?: string | null; onImageChange: (path: string, alt?: string) => void; onImageCreated: (path: string) => void; form: RouteDraft }) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'ai'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave' || e.type === 'drop') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleUploadClick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (e.target) e.target.value = '';
  };

  const uploadFile = async (file: File) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('file', file);
      if (form.origin) formData.append('origin', form.origin);
      if (form.destination) formData.append('destination', form.destination);
      if (form.imageAlt) formData.append('altText', form.imageAlt);

      const res = await fetchWithTimeout('/admin/api/transfer-routes/image', {
        method: 'POST',
        body: formData,
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseError(json, 'Yükleme başarısız'));
      const image = isJsonRecord(json.image) ? json.image : json;
      const path = typeof image.imagePath === 'string' ? image.imagePath : '';
      if (!path) throw new Error('Sunucu geçerli bir görsel yolu döndürmedi.');
      onImageCreated(path);
      onImageChange(path, typeof image.altText === 'string' ? image.altText : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleUrl = async () => {
    if (!urlInput || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError('');
    try {
      const res = await fetchWithTimeout('/admin/api/transfer-routes/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-url',
          url: urlInput,
          origin: form.origin,
          destination: form.destination,
          altText: form.imageAlt ?? undefined,
        }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseError(json, 'URL ekleme başarısız'));
      const image = isJsonRecord(json.image) ? json.image : json;
      const path = typeof image.imagePath === 'string' ? image.imagePath : '';
      if (!path) throw new Error('Sunucu geçerli bir görsel yolu döndürmedi.');
      onImageCreated(path);
      onImageChange(path, typeof image.altText === 'string' ? image.altText : undefined);
      setUrlInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleAI = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true); setError('');
    try {
      const res = await fetchWithTimeout('/admin/api/transfer-routes/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          name: form.name,
          origin: form.origin,
          destination: form.destination,
          altText: form.imageAlt ?? undefined,
        }),
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error(responseError(json, 'AI ile oluşturma başarısız'));
      const image = isJsonRecord(json.image) ? json.image : json;
      const path = typeof image.imagePath === 'string' ? image.imagePath : '';
      if (!path) throw new Error('Sunucu geçerli bir görsel yolu döndürmedi.');
      onImageCreated(path);
      onImageChange(path, typeof image.altText === 'string' ? image.altText : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  if (imagePath) {
    return (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '16px', background: '#F8FAFC' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '16px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePath} alt={imageAlt ?? ''} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${BORDER}` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Görsel Yolu (Salt Okunur)</label>
              <div style={{ ...inputStyle, background: '#EDF2F7', color: MUTED, display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {imagePath}
              </div>
            </div>
            <div>
              <label htmlFor="transfer-route-image-alt" style={labelStyle}>Alternatif Metin (Alt Text)</label>
              <input id="transfer-route-image-alt" style={inputStyle} value={imageAlt ?? ''} onChange={e => onImageChange(imagePath, e.target.value)} placeholder="Görseli açıklayan metin" />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => onImageChange('', '')} style={{ minHeight: '44px', fontSize: '13px', color: '#D64545', background: 'none', border: `1px solid #FECACA`, borderRadius: '6px', cursor: 'pointer', padding: '0 16px', fontWeight: 600 }}>Kaldır / Değiştir</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden', background: '#FFF' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setActiveTab('upload')} style={{ minHeight: '44px', flex: '1 1 auto', padding: '10px', fontSize: '13px', fontWeight: 600, color: activeTab === 'upload' ? '#2563EB' : MUTED, background: activeTab === 'upload' ? '#FFF' : 'transparent', border: 'none', borderBottom: activeTab === 'upload' ? '2px solid #2563EB' : '2px solid transparent', cursor: 'pointer' }}>Bilgisayardan Yükle</button>
        <button type="button" onClick={() => setActiveTab('url')} style={{ minHeight: '44px', flex: '1 1 auto', padding: '10px', fontSize: '13px', fontWeight: 600, color: activeTab === 'url' ? '#2563EB' : MUTED, background: activeTab === 'url' ? '#FFF' : 'transparent', border: 'none', borderBottom: activeTab === 'url' ? '2px solid #2563EB' : '2px solid transparent', cursor: 'pointer' }}>URL&apos;den Ekle</button>
        <button type="button" onClick={() => setActiveTab('ai')} style={{ minHeight: '44px', flex: '1 1 auto', padding: '10px', fontSize: '13px', fontWeight: 600, color: activeTab === 'ai' ? '#0369A1' : MUTED, background: activeTab === 'ai' ? '#FFF' : 'transparent', border: 'none', borderBottom: activeTab === 'ai' ? '2px solid #0369A1' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>AI ile Oluştur</button>
      </div>

      <div style={{ padding: '16px' }}>
        {error && <div style={{ color: '#D64545', fontSize: '13px', marginBottom: '12px', fontWeight: 500 }}>{error}</div>}

        {activeTab === 'upload' && (
          <label
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px',
              border: `2px dashed ${dragActive ? '#2563EB' : BORDER}`,
              borderRadius: '8px',
              background: dragActive ? '#EFF6FF' : '#F8FAFC',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1, padding: '20px'
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin" color={MUTED} /> : (
              <>
                <div style={{ fontSize: '24px', marginBottom: '8px', color: MUTED }}>+</div>
                <span style={{ fontSize: '13px', color: TEXT, fontWeight: 500 }}>Tıklayın veya sürükleyin</span>
                <span style={{ fontSize: '12px', color: MUTED, marginTop: '4px' }}>jpg, png, webp, avif</span>
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" style={{ display: 'none' }} onChange={handleUploadClick} disabled={loading} />
          </label>
        )}

        {activeTab === 'url' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: '1 1 200px' }} placeholder="https://example.com/image.jpg" value={urlInput} onChange={e => setUrlInput(e.target.value)} disabled={loading} />
             <button type="button" onClick={handleUrl} disabled={loading || !urlInput} style={{ minHeight: '44px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0 20px', fontSize: '13px', fontWeight: 600, cursor: loading || !urlInput ? 'not-allowed' : 'pointer', opacity: loading || !urlInput ? 0.6 : 1, flex: '0 0 auto' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ekle'}
            </button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '13px', color: MUTED, marginBottom: '16px', lineHeight: 1.5 }}>
              Girilen güzergâh bilgilerine (Kalkış ve Varış) uygun, özgün bir görsel oluşturulur. İşlem birkaç saniye sürebilir.
            </p>
            <button type="button" onClick={handleAI} disabled={loading || !form.origin || !form.destination} style={{ minHeight: '44px', background: '#0EA5E9', color: '#FFF', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: loading || !form.origin || !form.destination ? 'not-allowed' : 'pointer', opacity: loading || !form.origin || !form.destination ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Görsel Oluştur'}
            </button>
            {(!form.origin || !form.destination) && <div style={{ fontSize: '12px', color: '#D64545', marginTop: '12px' }}>Önce Kalkış ve Varış bilgilerini doldurun.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,43,58,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 8px 32px rgba(23,43,58,0.12)' }}>
        <h3 style={{ color: TEXT, fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: '0 0 10px' }}>{title}</h3>
        <p style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onCancel} style={{ minHeight: '44px', background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: 'pointer', padding: '8px 24px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Vazgeç</button>
          <button onClick={onConfirm} style={{ minHeight: '44px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#D64545', cursor: 'pointer', padding: '8px 24px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Sil</button>
        </div>
      </div>
    </div>
  );
}

// ── Route form modal ──────────────────────────────────────────────────────────
function RouteModal({ route, locationOptions, vehicleOptions, serviceOptions, onSave, onClose, saving }: {
  route: RouteDraft;
  locationOptions: ManagedLocation[];
  vehicleOptions: ManagedVehicle[];
  serviceOptions: { slug: string; title: string }[];
  onSave: (data: RouteDraft) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RouteDraft>({ ...route, translations: route.translations ?? [] });
  const [activeLocale, setActiveLocale] = useState<string>('tr');
  const [resolvingDistance, setResolvingDistance] = useState(false);
  const [distanceMessage, setDistanceMessage] = useState('');

  const [aiFilling, setAiFilling] = useState(false);
  const aiFillingRef = useRef(false);
  const [aiFillMessage, setAiFillMessage] = useState('');
  const [aiImageGenerating, setAiImageGenerating] = useState(false);
  const aiImageGeneratingRef = useRef(false);
  const [aiImageMessage, setAiImageMessage] = useState('');
  const [closing, setClosing] = useState(false);
  const [aiFillIncludeImage, setAiFillIncludeImage] = useState(true);
  const sessionImagePathsRef = useRef<Set<string>>(new Set());
  const deletingImagePathsRef = useRef<Map<string, Promise<void>>>(new Map());
  const sessionOpenRef = useRef(true);
  useEffect(() => () => {
    sessionOpenRef.current = false;
  }, []);

  const groupedLocations = useMemo(() => groupManagedLocationOptions(locationOptions), [locationOptions]);
  const set = <K extends keyof RouteDraft>(key: K, val: RouteDraft[K]) => setForm(f => ({ ...f, [key]: val }));

  const translation = form.translations?.find((item) => item.languageCode === activeLocale);
  const setTranslation = (key: keyof RouteTranslationDraft, value: unknown) => {
    if (activeLocale === 'tr') return;
    setForm((current) => {
      const currentTranslations = current.translations ?? [];
      const existing = currentTranslations.find((item) => item.languageCode === activeLocale);
      const next: RouteTranslationDraft = {
        languageCode: activeLocale,
        title: existing?.title ?? '',
        description: existing?.description ?? '',
        seoTitle: existing?.seoTitle ?? null,
        seoDescription: existing?.seoDescription ?? null,
        ogTitle: existing?.ogTitle ?? null,
        ogDescription: existing?.ogDescription ?? null,
        introParagraph: existing?.introParagraph ?? null,
        transportOptions: existing?.transportOptions ?? [],
        routeNotes: existing?.routeNotes ?? [],
        faqItems: existing?.faqItems ?? [],
        status: existing?.status ?? 'DRAFT',
        isManuallyLocked: existing?.isManuallyLocked ?? false,
        [key]: value,
      };
      return { ...current, translations: [...currentTranslations.filter((item) => item.languageCode !== activeLocale), next] };
    });
  };

  const deleteTemporaryImage = (path: string, force = false): Promise<void> => {
    if (!path || (!force && !sessionImagePathsRef.current.has(path))) return Promise.resolve();
    const existing = deletingImagePathsRef.current.get(path);
    if (existing) return existing;
    const deletion = (async () => {
      try {
        const response = await fetchWithTimeout('/admin/api/transfer-routes/image', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePath: path }),
        });
        const payload = await readJsonResponse(response);
        if (!response.ok) throw new Error(responseError(payload, 'Geçici görsel silinemedi.'));
        sessionImagePathsRef.current.delete(path);
      } catch (error) {
        setAiImageMessage(error instanceof Error ? error.message : 'Geçici görsel silinemedi.');
      } finally {
        deletingImagePathsRef.current.delete(path);
      }
    })();
    deletingImagePathsRef.current.set(path, deletion);
    return deletion;
  };

  const registerCreatedImage = (path: string) => {
    if (!path) return;
    if (sessionOpenRef.current) sessionImagePathsRef.current.add(path);
    else void deleteTemporaryImage(path, true);
  };

  const changeImage = (path: string, alt?: string) => {
    if (!sessionOpenRef.current) {
      if (path) void deleteTemporaryImage(path, true);
      return;
    }
    const previousPath = form.imagePath ?? '';
    if (previousPath && previousPath !== path && sessionImagePathsRef.current.has(previousPath)) {
      void deleteTemporaryImage(previousPath);
    }
    setForm(current => ({ ...current, imagePath: path, imageAlt: alt }));
  };

  const closeModal = async () => {
    if (closing) return;
    setClosing(true);
    sessionOpenRef.current = false;
    await Promise.allSettled(
      Array.from(sessionImagePathsRef.current, path => deleteTemporaryImage(path)),
    );
    onClose();
  };

  const generateAiFillImage = async (sourceForm: RouteDraft) => {
    if (aiImageGeneratingRef.current || !sourceForm.origin || !sourceForm.destination) return;
    aiImageGeneratingRef.current = true;
    setAiImageGenerating(true);
    setAiImageMessage('Görsel oluşturuluyor…');
    try {
      const response = await fetchWithTimeout('/admin/api/transfer-routes/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          name: sourceForm.name,
          origin: sourceForm.origin,
          destination: sourceForm.destination,
          altText: sourceForm.imageAlt ?? undefined,
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(responseError(payload, 'AI görseli oluşturulamadı.'));
      const image = isJsonRecord(payload.image) ? payload.image : payload;
      const path = typeof image.imagePath === 'string' ? image.imagePath : '';
      if (!path) throw new Error('Sunucu geçerli bir görsel yolu döndürmedi.');
      registerCreatedImage(path);
      if (sessionOpenRef.current) {
        changeImage(path, typeof image.altText === 'string' ? image.altText : undefined);
        setAiImageMessage('Görsel başarıyla oluşturuldu.');
      } else {
        await deleteTemporaryImage(path, true);
      }
    } catch (error) {
      setAiImageMessage(error instanceof Error ? error.message : 'Görsel oluşturulamadı.');
    } finally {
      aiImageGeneratingRef.current = false;
      setAiImageGenerating(false);
    }
  };

  const fillWithAI = async () => {
    if (aiFillingRef.current || !form.name || !form.origin || !form.destination) return;

    const hasContent = !!(
      form.description || form.introParagraph || (form.transportOptions && form.transportOptions.length > 0) ||
      (form.routeNotes && form.routeNotes.length > 0) || (form.faqItems && form.faqItems.length > 0) ||
      form.seoTitle || form.seoDescription || form.ogTitle || form.ogDescription || form.relatedServiceSlug || form.imagePath
    );

    let overwrite = false;
    if (hasContent) {
      overwrite = window.confirm('Mevcut içerikleriniz (açıklama, SEO, SSS vb.) yapay zeka tarafından üretilen yeni içeriklerle değiştirilsin mi? (İptal derseniz yalnızca boş alanlar doldurulacaktır)');
    }

    aiFillingRef.current = true;
    setAiFilling(true);
    setAiFillMessage('');
    setAiImageMessage('');
    const includeImageAfterText = aiFillIncludeImage;
    let textPayload: Record<string, unknown> | null = null;
    try {
      const response = await fetchWithTimeout('/admin/api/transfer-routes/ai-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          origin: form.origin,
          destination: form.destination,
          originLocationId: form.originLocationId,
          destinationLocationId: form.destinationLocationId,
          includeImage: false,
          overwrite,
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        setAiFillMessage(responseError(payload, 'AI ile doldurma işlemi başarısız oldu.'));
        return;
      }
      textPayload = payload;

      setForm(current => {
        const content = isJsonRecord(payload.content) ? payload.content : {};
        const mergeStr = (oldVal: string | null | undefined, newVal: string | null | undefined) =>
          (!overwrite && oldVal && oldVal.trim().length > 0) ? oldVal : (newVal ?? oldVal ?? undefined);

        const mergeArr = <T,>(oldArr: T[] | null | undefined, newArr: T[] | null | undefined): T[] | undefined =>
          (!overwrite && oldArr && oldArr.length > 0) ? oldArr : (newArr ?? oldArr ?? undefined);

        const hasVerifiedPayload = payload.distanceSource === 'ADMIN_VERIFIED';
        const payloadDistanceSource = typeof payload.distanceSource === 'string'
          ? payload.distanceSource as RouteDraft['distanceSource']
          : current.distanceSource;
        const payloadDistanceKm = typeof payload.distanceKm === 'number'
          ? payload.distanceKm
          : current.distanceKm;
        const payloadDurationMinutes = typeof payload.durationMinutes === 'number'
          ? payload.durationMinutes
          : current.durationMinutes;
        const distanceSource = hasVerifiedPayload
          ? 'ADMIN_VERIFIED'
          : payloadDistanceSource;
        const distanceKm = hasVerifiedPayload
          ? payloadDistanceKm
          : payloadDistanceKm;
        const durationMinutes = hasVerifiedPayload
          ? payloadDurationMinutes
          : payloadDurationMinutes;
        const keepExistingImage = !overwrite && Boolean(current.imagePath?.trim());

        return {
          ...current,
          distanceKm,
          durationMinutes,
          distanceSource,
          description: mergeStr(current.description, typeof content.description === 'string' ? content.description : undefined),
          introParagraph: mergeStr(current.introParagraph, typeof content.introParagraph === 'string' ? content.introParagraph : undefined),
          transportOptions: mergeArr(current.transportOptions, Array.isArray(content.transportOptions) ? content.transportOptions as RouteTransportOption[] : undefined),
          routeNotes: mergeArr(current.routeNotes, Array.isArray(content.routeNotes) ? content.routeNotes as string[] : undefined),
          faqItems: mergeArr(current.faqItems, Array.isArray(content.faqItems) ? content.faqItems as RouteFaqItem[] : undefined),
          seoTitle: mergeStr(current.seoTitle, typeof content.seoTitle === 'string' ? content.seoTitle : undefined),
          seoDescription: mergeStr(current.seoDescription, typeof content.seoDescription === 'string' ? content.seoDescription : undefined),
          ogTitle: mergeStr(current.ogTitle, typeof content.ogTitle === 'string' ? content.ogTitle : undefined),
          ogDescription: mergeStr(current.ogDescription, typeof content.ogDescription === 'string' ? content.ogDescription : undefined),
          relatedServiceSlug: mergeStr(current.relatedServiceSlug, typeof content.relatedServiceSlug === 'string' ? content.relatedServiceSlug : undefined),
          imageAlt: keepExistingImage
            ? current.imageAlt
            : current.imageAlt,
        };
      });
      setAiFillMessage('Metin alanları başarıyla dolduruldu.');
    } catch (error) {
      setAiFillMessage(error instanceof Error ? error.message : 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      aiFillingRef.current = false;
      setAiFilling(false);
    }
    if (textPayload && includeImageAfterText) {
      void generateAiFillImage(form);
    }
  };

  const numField = (key: keyof TransferRoute, label: string, placeholder?: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" min={key === 'distanceKm' || key === 'durationMinutes' ? '1' : '0'} style={inputStyle} placeholder={placeholder}
        value={String(form[key] ?? 0)}
        onChange={e => {
          setForm((current) => ({ ...current, [key]: Number(e.target.value) }));
          if (key === 'distanceKm' && form.distanceSource !== 'ADMIN_VERIFIED') set('distanceSource', 'LEGACY_UNVERIFIED');
        }}
      />
    </div>
  );

  const resolveGoogleMapsDistance = async () => {
    if (!form.originLocationId || !form.destinationLocationId) {
      setDistanceMessage('Önce iki kayıtlı lokasyonu seçin.');
      return;
    }
    setResolvingDistance(true);
    setDistanceMessage('');
    try {
      const response = await fetchWithTimeout('/admin/api/location-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originLocationId: form.originLocationId,
          destinationLocationId: form.destinationLocationId,
        }),
      });
      const payload = await readJsonResponse(response);
      const resultPayload = isJsonRecord(payload.result) ? payload.result : null;
      if (!response.ok || !resultPayload || resultPayload.state === 'UNAVAILABLE') {
        setDistanceMessage(responseError(payload, 'Google Maps yol mesafesi hesaplanamadı.'));
        return;
      }
       const result = resultPayload as { distanceKm: number; durationMinutes?: number; source: string; roadDistanceMultiplier?: number };
      setForm((current) => ({
        ...current,
        distanceKm: result.distanceKm,
         ...(result.source === 'google_maps' && result.durationMinutes
           ? { durationMinutes: result.durationMinutes }
           : {}),
        distanceSource: result.source === 'defined_route'
          ? 'ADMIN_VERIFIED'
          : result.source === 'coordinate_estimate'
            ? 'COORDINATE_ESTIMATE'
             : 'ADMIN_VERIFIED',
      }));
      setDistanceMessage(
        result.source === 'google_maps'
          ? `Google Maps Routes sonucu: ${result.distanceKm} km, ${result.durationMinutes} dakika. Mesafe ve süre forma dolduruldu.`
          : result.source === 'defined_route'
            ? `Google Maps kullanılamadı; kayıtlı doğrulanmış ${result.distanceKm} km rota kullanıldı.`
            : `Google Maps kullanılamadı; dahili güvenlik tahmini ${result.distanceKm} km${result.roadDistanceMultiplier ? ` (yol katsayısı ×${result.roadDistanceMultiplier})` : ''}.`,
      );
    } catch {
      setDistanceMessage('Mesafe servisine ulaşılamadı. Tekrar deneyin.');
    } finally {
      setResolvingDistance(false);
    }
  };

  const localeStripRef = useRef<HTMLDivElement | null>(null);
  const localeTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const localeCodes = useMemo(() => ['tr', ...LOCALES.map(([code]) => code)], []);
  const focusLocale = (code: string) => {
    setActiveLocale(code);
    window.requestAnimationFrame(() => localeTabRefs.current[code]?.focus());
  };
  const handleLocaleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, code: string) => {
    const currentIndex = localeCodes.indexOf(code);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % localeCodes.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + localeCodes.length) % localeCodes.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = localeCodes.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    focusLocale(localeCodes[nextIndex]);
  };
  useEffect(() => {
    const strip = localeStripRef.current;
    const tab = localeTabRefs.current[activeLocale];
    if (!strip || !tab) return;
    const tabStart = tab.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    const visibleStart = strip.scrollLeft;
    const visibleEnd = visibleStart + strip.clientWidth;
    if (tabStart < visibleStart) strip.scrollLeft = Math.max(0, tabStart - 8);
    else if (tabEnd > visibleEnd) strip.scrollLeft = tabEnd - strip.clientWidth + 8;
  }, [activeLocale]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(23,43,58,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '24px', maxWidth: '780px', width: '100%', maxHeight: 'calc(100dvh - 32px)', boxSizing: 'border-box', boxShadow: '0 8px 40px rgba(23,43,58,0.14)', margin: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', minWidth: 0, flex: '0 0 auto' }}>
          <h2 style={{ color: TEXT, fontSize: '18px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
            {form.id ? 'Güzergahı Düzenle' : 'Yeni Güzergah Ekle'}
          </h2>
          <button onClick={closeModal} disabled={closing || saving} style={{ background: 'none', border: 'none', cursor: closing || saving ? 'wait' : 'pointer', color: MUTED, padding: '4px', borderRadius: '6px', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, overflowY: 'auto', paddingRight: '2px', overscrollBehavior: 'contain' }}>
        <div ref={localeStripRef} role="tablist" aria-label="Güzergâh içerik dilleri" onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.currentTarget.scrollLeft += event.deltaY; event.preventDefault(); } }} style={{ display: 'flex', gap: '8px', overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', minWidth: 0, paddingBottom: '12px', borderBottom: `1px solid ${BORDER}`, marginBottom: '20px', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
          <button ref={(element) => { localeTabRefs.current.tr = element; }} role="tab" aria-selected={activeLocale === 'tr'} tabIndex={activeLocale === 'tr' ? 0 : -1} type="button" onClick={() => setActiveLocale('tr')} onKeyDown={(event) => handleLocaleKeyDown(event, 'tr')} style={{ minHeight: '44px', flex: '0 0 auto', border: `1px solid ${activeLocale === 'tr' ? '#2563EB' : BORDER}`, borderRadius: '7px', background: activeLocale === 'tr' ? '#EFF6FF' : BG, color: activeLocale === 'tr' ? '#2563EB' : MUTED, padding: '0 16px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '13px' }}>Türkçe kaynak</button>
          {LOCALES.map(([code, label]) => {
            const status = form.translations?.find((item) => item.languageCode === code)?.status;
            return <button ref={(element) => { localeTabRefs.current[code] = element; }} role="tab" aria-selected={activeLocale === code} tabIndex={activeLocale === code ? 0 : -1} key={code} type="button" onClick={() => setActiveLocale(code)} onKeyDown={(event) => handleLocaleKeyDown(event, code)} style={{ minHeight: '44px', flex: '0 0 auto', border: `1px solid ${activeLocale === code ? '#2563EB' : BORDER}`, borderRadius: '7px', background: activeLocale === code ? '#EFF6FF' : BG, color: activeLocale === code ? '#2563EB' : MUTED, padding: '0 16px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 500 }}>{label}{status === 'PUBLISHED' ? ' • ✓' : ''}</button>;
          })}
        </div>

        {activeLocale === 'tr' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Güzergah Adı *</label>
            <input style={inputStyle} placeholder="örn: Taksim → Sabiha Gökçen Havalimanı" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Sayfa Açıklaması *</label>
            <textarea style={{ ...inputStyle, minHeight: '94px', resize: 'vertical' }} placeholder="Güzergah için ziyaretçiye gösterilecek özgün açıklama" value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Origin / Destination */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Kalkış *</label>
              <input style={inputStyle} placeholder="örn: Taksim" value={form.origin ?? ''} onChange={e => set('origin', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Varış *</label>
              <input style={inputStyle} placeholder="örn: Sabiha Gökçen Havalimanı" value={form.destination ?? ''} onChange={e => set('destination', e.target.value)} />
            </div>
          </div>

          {/* AI Fill Block */}
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h4 style={{ color: '#0369A1', fontSize: '15px', margin: '0 0 6px', fontWeight: 600 }}>AI ile Güzergâhı Doldur</h4>
                <p style={{ color: '#0284C7', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
                  Ad, kalkış ve varış noktalarını girin; mesafe, süre, ulaşım seçenekleri, SSS ve SEO alanlarını yapay zekaya bırakın.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0369A1', cursor: 'pointer', userSelect: 'none', minHeight: '44px' }}>
                   <input type="checkbox" checked={aiFillIncludeImage} onChange={e => setAiFillIncludeImage(e.target.checked)} disabled={aiFilling} style={{ width: '16px', height: '16px', cursor: aiFilling ? 'not-allowed' : 'pointer' }} />
                  Görseli de oluştur
                </label>
                 <button
                  type="button"
                  onClick={fillWithAI}
                    disabled={aiFilling || !form.name || !form.origin || !form.destination}
                  style={{
                    minHeight: '44px', background: '#0EA5E9', border: 'none', borderRadius: '8px', color: '#FFF',
                     padding: '0 20px', fontSize: '13px', fontWeight: 600, cursor: aiFilling || !form.name || !form.origin || !form.destination ? 'not-allowed' : 'pointer',
                     opacity: aiFilling || !form.name || !form.origin || !form.destination ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                   {aiFilling && <Loader2 size={16} className="animate-spin" />}
                  Otomatik Doldur
                </button>
              </div>
            </div>
            {aiFillMessage && (
              <div style={{ fontSize: '13px', color: aiFillMessage.includes('başarı') ? '#15803D' : '#B91C1C', fontWeight: 500, padding: '12px', background: aiFillMessage.includes('başarı') ? '#F0FDF4' : '#FEF2F2', borderRadius: '6px', border: `1px solid ${aiFillMessage.includes('başarı') ? '#BBF7D0' : '#FECACA'}` }}>
                {aiFillMessage}
              </div>
            )}
            {aiImageMessage && (
              <div style={{ fontSize: '13px', color: aiImageMessage.includes('başarı') || aiImageMessage.includes('oluşturuluyor') ? '#0369A1' : '#B91C1C', fontWeight: 500, padding: '12px', background: aiImageMessage.includes('başarı') || aiImageMessage.includes('oluşturuluyor') ? '#F0F9FF' : '#FEF2F2', borderRadius: '6px', border: `1px solid ${aiImageMessage.includes('başarı') || aiImageMessage.includes('oluşturuluyor') ? '#BAE6FD' : '#FECACA'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {aiImageGenerating && <Loader2 size={16} className="animate-spin" />}
                {aiImageMessage}
              </div>
            )}
          </div>

          <RouteContentFields
            value={form}
            locale="tr"
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', padding: '16px', border: `1px solid ${BORDER}`, borderRadius: '8px', background: '#F8FAFC' }}>
            <div>
              <label style={labelStyle}>Doğrulanmış Kalkış Lokasyonu</label>
              <select style={inputStyle} value={form.originLocationId ?? ''} onChange={e => set('originLocationId', e.target.value || null)}>
                <option value="">Seçiniz</option>
                {groupedLocations.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(location => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Doğrulanmış Varış Lokasyonu</label>
              <select style={inputStyle} value={form.destinationLocationId ?? ''} onChange={e => set('destinationLocationId', e.target.value || null)}>
                <option value="">Seçiniz</option>
                {groupedLocations.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(location => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <p style={{ gridColumn: '1 / -1', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, margin: 0 }}>
              İki kayıtlı lokasyonu birlikte seçin. Yol mesafesi Google Maps Routes üzerinden alınır; Google kullanılamazsa kayıtlı doğrulanmış rota veya dahili güvenlik tahmini devreye girer.
            </p>
          </div>

          {/* Distance / Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
            {numField('distanceKm', 'Yaklaşık Mesafe (km)')}
            {numField('durationMinutes', 'Referans Süre (dakika)')}
            {numField('normalDurationMinMinutes', 'Normal Trafik Min. (dk)')}
            {numField('normalDurationMaxMinutes', 'Normal Trafik Maks. (dk)')}
            {numField('peakDurationMinMinutes', 'Yoğun Saat Min. (dk)')}
            {numField('peakDurationMaxMinutes', 'Yoğun Saat Maks. (dk)')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: TEXT, minHeight: '44px' }}>
            <input type="checkbox" checked={form.hasCrossContinentPassage ?? false} onChange={(event) => set('hasCrossContinentPassage', event.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            Rota yaka geçişi içeriyor
          </label>
          <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <button type="button" onClick={resolveGoogleMapsDistance} disabled={resolvingDistance || !form.originLocationId || !form.destinationLocationId} style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '7px', color: '#1D4ED8', padding: '0 20px', fontSize: '13px', fontWeight: 600, cursor: resolvingDistance ? 'wait' : 'pointer', opacity: !form.originLocationId || !form.destinationLocationId ? 0.55 : 1 }}>
              {resolvingDistance ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
              Google Maps Yol Mesafesini Getir
            </button>
            {distanceMessage && <span style={{ width: '100%', color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{distanceMessage}</span>}
          </div>
          <div>
            <label style={labelStyle}>Varsayılan Araç (isteğe bağlı)</label>
            <select style={inputStyle} value={form.defaultVehicleId ?? ''} onChange={(event) => set('defaultVehicleId', event.target.value || null)}>
              <option value="">Yönetici fiyat sorgusunda seçsin</option>
              {vehicleOptions.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}{vehicle.priceCalculationEligible ? '' : ' — talep üzerine'}</option>)}
            </select>
          </div>

          {/* Vito prices */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Mercedes Vito Fiyat Aralığı (EUR)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
              {numField('priceVitoMinEur', 'Min EUR')}
              {numField('priceVitoMaxEur', 'Max EUR')}
            </div>
          </div>

          {/* Sprinter prices */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Mercedes Sprinter Fiyat Aralığı (EUR)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
              {numField('priceSprinterMinEur', 'Min EUR')}
              {numField('priceSprinterMaxEur', 'Max EUR')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
            <div><label style={labelStyle}>SEO Başlığı</label><input style={inputStyle} value={form.seoTitle ?? ''} onChange={e => set('seoTitle', e.target.value)} /></div>
            <div>
              <label style={labelStyle}>İlgili Hizmet</label>
              <select style={inputStyle} value={form.relatedServiceSlug ?? ''} onChange={e => set('relatedServiceSlug', e.target.value)}>
                <option value="">Seçiniz</option>
                {serviceOptions.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}
              </select>
            </div>
          </div>
          <AISeoGenerator context="route" title={form.seoTitle ?? ''} description={form.seoDescription ?? ''}
            onTitleChange={v => set('seoTitle', v)} onDescriptionChange={v => set('seoDescription', v)} />
          <div><label style={labelStyle}>SEO Açıklaması</label><textarea style={{ ...inputStyle, minHeight: '66px', resize: 'vertical' }} value={form.seoDescription ?? ''} onChange={e => set('seoDescription', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
            <div><label style={labelStyle}>Open Graph Başlığı</label><input style={inputStyle} value={form.ogTitle ?? ''} onChange={e => set('ogTitle', e.target.value)} /></div>
            <div><label style={labelStyle}>Open Graph Açıklaması</label><input style={inputStyle} value={form.ogDescription ?? ''} onChange={e => set('ogDescription', e.target.value)} /></div>
          </div>

          {/* Image Editor */}
          <div>
            <label style={labelStyle}>Güzergâh Görseli</label>
            <RouteImageEditor
              imagePath={form.imagePath ?? ''}
              imageAlt={form.imageAlt ?? ''}
               onImageCreated={registerCreatedImage}
               onImageChange={changeImage}
              form={form}
            />
          </div>

          {/* Display order + active */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', alignItems: 'end' }}>
            {numField('displayOrder', 'Sıra')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '4px' }}>
              <label style={labelStyle}>Durum</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: TEXT, minHeight: '44px' }}>
                <input type="checkbox" checked={form.active ?? true} onChange={e => set('active', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Aktif (ana sayfada göster)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: TEXT, minHeight: '44px' }}>
                <input type="checkbox" checked={form.indexable ?? true} onChange={e => set('indexable', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Arama motorlarında indekslenebilir
              </label>
            </div>
          </div>
        </div> : !form.id ? (
          <div style={{ padding: '24px', borderRadius: '10px', background: '#F8FAFC', color: MUTED, fontSize: '14px', lineHeight: 1.6 }}>Önce Türkçe rotayı kaydedin. Ardından her dil için sayfa metnini ekleyip yayın durumunu seçebilirsiniz.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, padding: '16px', borderRadius: '8px', color: MUTED, fontSize: '13px', lineHeight: 1.55 }}>Bu sayfa yalnızca <strong>PUBLISHED</strong> durumuna getirildiğinde ziyaretçilere, sitemap&apos;e ve hreflang etiketlerine eklenir. Eksik çeviri Türkçe metne düşmez.</div>
            <div><label style={labelStyle}>Başlık *</label><input style={inputStyle} value={translation?.title ?? ''} onChange={e => setTranslation('title', e.target.value)} /></div>
            <div><label style={labelStyle}>Sayfa Açıklaması *</label><textarea dir={activeLocale === 'ar' ? 'rtl' : 'ltr'} style={{ ...inputStyle, minHeight: '112px', resize: 'vertical' }} value={translation?.description ?? ''} onChange={e => setTranslation('description', e.target.value)} /></div>
            <RouteContentFields
              value={translation ?? {}}
              locale={activeLocale}
              onChange={(patch) => {
                for (const [key, value] of Object.entries(patch)) {
                  setTranslation(key as keyof RouteTranslationDraft, value);
                }
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
              <div><label style={labelStyle}>SEO Başlığı</label><input style={inputStyle} value={translation?.seoTitle ?? ''} onChange={e => setTranslation('seoTitle', e.target.value)} /></div>
              <div><label style={labelStyle}>Yayın Durumu</label><select style={inputStyle} value={translation?.status ?? 'DRAFT'} onChange={e => setTranslation('status', e.target.value)}><option value="DRAFT">Taslak</option><option value="REVIEW">İncelemede</option><option value="APPROVED">Onaylandı</option><option value="PUBLISHED">Yayında</option><option value="OUTDATED">Güncellenecek</option></select></div>
            </div>
            <AISeoGenerator context="route" language={activeLocale} title={translation?.seoTitle ?? ''} description={translation?.seoDescription ?? ''}
              onTitleChange={v => setTranslation('seoTitle', v)} onDescriptionChange={v => setTranslation('seoDescription', v)} />
            <div><label style={labelStyle}>SEO Açıklaması</label><textarea style={{ ...inputStyle, minHeight: '66px', resize: 'vertical' }} value={translation?.seoDescription ?? ''} onChange={e => setTranslation('seoDescription', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
              <div><label style={labelStyle}>Open Graph Başlığı</label><input style={inputStyle} value={translation?.ogTitle ?? ''} onChange={e => setTranslation('ogTitle', e.target.value)} /></div>
              <div><label style={labelStyle}>Open Graph Açıklaması</label><input style={inputStyle} value={translation?.ogDescription ?? ''} onChange={e => setTranslation('ogDescription', e.target.value)} /></div>
            </div>
          </div>
        )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap', flex: '0 0 auto', background: BG }}>
          <button onClick={closeModal} disabled={saving || closing} style={{ minHeight: '44px', background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: saving || closing ? 'wait' : 'pointer', padding: '0 24px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>İptal</button>
          <button
            onClick={() => onSave(form)}
             disabled={saving || closing || aiFilling || !form.name || !form.origin || !form.destination}
             style={{ minHeight: '44px', background: '#2563EB', border: 'none', borderRadius: '8px', color: '#FFFFFF', cursor: saving || closing || aiFilling ? 'wait' : 'pointer', padding: '0 24px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: saving || closing || aiFilling ? 0.7 : 1 }}
          >
            <Check size={16} />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main list component ───────────────────────────────────────────────────────
export default function TransferRotalariList() {
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modal, setModal] = useState<RouteDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TransferRoute | null>(null);
  const [locationOptions, setLocationOptions] = useState<ManagedLocation[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<ManagedVehicle[]>([]);
  const [serviceOptions, setServiceOptions] = useState<{slug: string, title: string}[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/transfer-routes');
      if (!res.ok) throw new Error('API hatası');
      const json = await res.json();
      setRoutes(json.routes ?? []);
      setServiceOptions(json.serviceOptions ?? json.services ?? []);
    } catch {
      setError('Rotalar yüklenemedi. Lütfen sayfayı yenileyin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);
  useEffect(() => {
    fetch('/admin/api/locations?active=true')
      .then((response) => response.ok ? response.json() : { locations: [] })
      .then((payload) => setLocationOptions(payload.items ?? []))
      .catch(() => setLocationOptions([]));
  }, []);
  useEffect(() => {
    fetch('/admin/api/vehicles?limit=100')
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((payload) => setVehicleOptions(payload.items ?? []))
      .catch(() => setVehicleOptions([]));
  }, []);

  async function handleSave(data: RouteDraft) {
    setSaving(true);
    setActionError('');
    try {
      const isEdit = !!data.id;
      const url = isEdit ? `/admin/api/transfer-routes/${data.id}` : '/admin/api/transfer-routes';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError(json.error ?? 'Kaydetme başarısız.');
        return;
      }
      setModal(null);
      await fetchRoutes();
    } catch {
      setActionError('Sunucu hatası. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(route: TransferRoute) {
    setConfirmDelete(null);
    setActionError('');
    try {
      const res = await fetch(`/admin/api/transfer-routes/${route.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError(json.error ?? 'Silme başarısız.');
        return;
      }
      await fetchRoutes();
    } catch {
      setActionError('Sunucu hatası. Tekrar deneyin.');
    }
  }

  async function listAction(route: AdminRoute, action: 'up' | 'down' | 'toggle-active') {
    setActionId(route.id);
    setActionError('');
    try {
      const res = await fetch(`/admin/api/transfer-routes/${route.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'İşlem başarısız.');
      if (Array.isArray(json.routes)) {
        setRoutes(json.routes.map((next: AdminRoute) => ({
          ...next,
          translations: next.translations ?? [],
        })));
        return;
      }
      setRoutes((current) => {
        if (action === 'toggle-active') return current.map((item) => item.id === route.id ? { ...item, active: json.route.active } : item);
        const index = current.findIndex((item) => item.id === route.id);
        const peerIndex = action === 'up' ? index - 1 : index + 1;
        if (index < 0 || peerIndex < 0 || peerIndex >= current.length) return current;
        const next = [...current]; [next[index], next[peerIndex]] = [next[peerIndex], next[index]];
        return next;
      });
    } catch (error) { setActionError(error instanceof Error ? error.message : 'İşlem başarısız.'); }
    finally { setActionId(null); }
  }

  function formatDuration(min: number) {
    if (min < 60) return `${min} dk`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
  }

  return (
    <div>
      <style>{`
        @media (max-width: 899px) {
          .route-list-table-wrap { overflow: visible !important; }
          .route-list-table, .route-list-table tbody { display: block; width: 100%; }
          .route-list-table thead { display: none; }
          .route-list-table tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 10px; padding: 10px; border-bottom: 1px solid ${BORDER}; }
          .route-list-table td { display: flex; align-items: center; min-width: 0; padding: 8px 4px !important; overflow-wrap: anywhere; }
          .route-list-table td:first-child, .route-list-table td:nth-child(2), .route-list-table td:last-child { grid-column: 1 / -1; }
          .route-list-table td:last-child > div { flex-wrap: wrap; }
        }
        @media (max-width: 480px) { .route-list-table tr { grid-template-columns: 1fr; } }
      `}</style>
      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={() => setModal({ ...EMPTY })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 20px', borderRadius: '8px', background: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} />
          Yeni Güzergah Ekle
        </button>
      </div>

      {/* Action error */}
      {actionError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '16px' }}>
          {actionError}
        </div>
      )}

      {/* Loading / Error / Empty */}
      {loading ? (
        <div style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '48px 0', textAlign: 'center' }}>Yükleniyor…</div>
      ) : error ? (
        <div style={{ color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>
      ) : routes.length === 0 ? (
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '60px 32px', textAlign: 'center' }}>
          <p style={{ color: MUTED, fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0 }}>Henüz güzergah eklenmedi. &quot;Yeni Güzergah Ekle&quot; butonunu kullanın.</p>
        </div>
      ) : (
        /* Table */
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
           <div className="route-list-table-wrap" style={{ overflowX: 'auto' }}>
             <table className="route-list-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
                  {['Görsel', 'Güzergah', 'Mesafe / Süre', 'Vito (€)', 'Sprinter (€)', 'Sıra', 'Durum', 'İşlem'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', color: MUTED, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.map((r, index) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid #EDF2F7` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Image */}
                    <td style={{ padding: '12px 16px' }}>
                      {r.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imagePath} alt={r.name} style={{ width: '64px', height: '44px', objectFit: 'cover', borderRadius: '4px', background: '#EDF2F7' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: '64px', height: '44px', background: '#EDF2F7', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: MUTED, fontWeight: 600 }}>Görsel Yok</div>
                      )}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                      <div style={{ color: TEXT, fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{r.name}</div>
                      <div style={{ color: MUTED, fontSize: '12px' }}>{r.origin} → {r.destination}</div>
                    </td>

                    {/* Distance / Duration */}
                    <td style={{ padding: '12px 16px', color: MUTED, whiteSpace: 'nowrap' }}>
                      <div style={{ color: TEXT, fontWeight: 500, marginBottom: '2px' }}>{r.distanceKm} km</div>
                      <div style={{ fontSize: '12px' }}>{formatDuration(r.durationMinutes)}</div>
                      <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 700, color: r.distanceSource === 'ADMIN_VERIFIED' ? '#047857' : r.distanceSource === 'COORDINATE_ESTIMATE' ? '#1D4ED8' : '#A16207' }}>
                        {r.distanceSource === 'ADMIN_VERIFIED' ? 'Doğrulanmış' : r.distanceSource === 'COORDINATE_ESTIMATE' ? 'Güvenlik tahmini' : 'Doğrulanmamış'}
                      </div>
                    </td>

                    {/* Vito price */}
                    <td style={{ padding: '12px 16px', color: TEXT, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {r.priceVitoMinEur}–{r.priceVitoMaxEur}
                    </td>

                    {/* Sprinter price */}
                    <td style={{ padding: '12px 16px', color: TEXT, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {r.priceSprinterMinEur}–{r.priceSprinterMaxEur}
                    </td>

                    {/* Display order */}
                    <td style={{ padding: '12px 16px', color: MUTED }}>{r.displayOrder}</td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: r.active ? '#F0FDF4' : '#FEF2F2', color: r.active ? '#16A34A' : '#D64545', border: `1px solid ${r.active ? '#BBF7D0' : '#FECACA'}` }}>
                        {r.active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px' }}>
                      <AdminRecordActions
                        up={{ onClick: () => listAction(r, 'up'), disabled: index === 0 || actionId === r.id }}
                        down={{ onClick: () => listAction(r, 'down'), disabled: index === routes.length - 1 || actionId === r.id }}
                        edit={{ onClick: () => setModal({ ...r }) }}
                        activation={{ onClick: () => listAction(r, 'toggle-active'), isActive: r.active, disabled: actionId === r.id }}
                        delete={{ onClick: () => setConfirmDelete(r) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <RouteModal
          route={modal}
          locationOptions={locationOptions}
          vehicleOptions={vehicleOptions}
          serviceOptions={serviceOptions}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Güzergahı Sil"
          message={`"${confirmDelete.name}" güzergahı kalıcı olarak silinecektir. Bu işlem geri alınamaz.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
