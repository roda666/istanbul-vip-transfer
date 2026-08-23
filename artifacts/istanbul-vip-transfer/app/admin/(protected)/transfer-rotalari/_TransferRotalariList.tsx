'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import type { TransferRoute, TransferRouteTranslation } from '@/db/schema';

// ── Design tokens ────────────────────────────────────────────────────────────
const BORDER = '#D8E1E9';
const TEXT    = '#172B3A';
const MUTED   = '#718596';
const BG      = '#FFFFFF';

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: '6px',
  color: TEXT, fontSize: '13px', fontFamily: 'Inter, sans-serif',
  padding: '8px 10px', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
};

// ── Empty form ───────────────────────────────────────────────────────────────
const EMPTY: Partial<TransferRoute> = {
  name: '', origin: '', destination: '',
  distanceKm: 0, durationMinutes: 0,
  priceVitoMinEur: 0, priceVitoMaxEur: 0,
  priceSprinterMinEur: 0, priceSprinterMaxEur: 0,
  imagePath: '', displayOrder: 0, active: true, description: '', seoTitle: '', seoDescription: '',
  ogTitle: '', ogDescription: '', relatedServiceSlug: 'vip-transfer', indexable: true,
};

type RouteTranslationDraft = Pick<TransferRouteTranslation,
  'languageCode' | 'title' | 'description' | 'seoTitle' | 'seoDescription' | 'ogTitle' | 'ogDescription' | 'status' | 'isManuallyLocked'>;
type AdminRoute = TransferRoute & { translations: RouteTranslationDraft[] };
type RouteDraft = Partial<TransferRoute> & { translations?: RouteTranslationDraft[] };
type ManagedLocation = {
  id: string;
  name: string;
  city: string;
};

const LOCALES = [
  ['en', 'English'], ['de', 'Deutsch'], ['ru', 'Русский'], ['ar', 'العربية'],
  ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['nl', 'Nederlands'],
] as const;

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,43,58,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 8px 32px rgba(23,43,58,0.12)' }}>
        <h3 style={{ color: TEXT, fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: '0 0 10px' }}>{title}</h3>
        <p style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: 'pointer', padding: '8px 16px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Vazgeç</button>
          <button onClick={onConfirm} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#D64545', cursor: 'pointer', padding: '8px 16px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Sil</button>
        </div>
      </div>
    </div>
  );
}

// ── Route form modal ──────────────────────────────────────────────────────────
function RouteModal({ route, locationOptions, onSave, onClose, saving }: {
  route: RouteDraft;
  locationOptions: ManagedLocation[];
  onSave: (data: RouteDraft) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RouteDraft>({ ...route, translations: route.translations ?? [] });
  const [activeLocale, setActiveLocale] = useState<string>('tr');
  const set = (key: keyof TransferRoute, val: unknown) => setForm(f => ({ ...f, [key]: val }));
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
        status: existing?.status ?? 'DRAFT',
        isManuallyLocked: existing?.isManuallyLocked ?? false,
        [key]: value,
      };
      return { ...current, translations: [...currentTranslations.filter((item) => item.languageCode !== activeLocale), next] };
    });
  };

  const numField = (key: keyof TransferRoute, label: string, placeholder?: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" min="0" style={inputStyle} placeholder={placeholder}
        value={String(form[key] ?? 0)}
        onChange={e => set(key, Number(e.target.value))}
      />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(23,43,58,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '28px', maxWidth: '780px', width: '100%', boxShadow: '0 8px 40px rgba(23,43,58,0.14)', margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: TEXT, fontSize: '16px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: 0 }}>
            {form.id ? 'Güzergahı Düzenle' : 'Yeni Güzergah Ekle'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: '4px', borderRadius: '6px' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', borderBottom: `1px solid ${BORDER}`, marginBottom: '18px' }}>
          <button type="button" onClick={() => setActiveLocale('tr')} style={{ border: `1px solid ${activeLocale === 'tr' ? '#2563EB' : BORDER}`, borderRadius: '7px', background: activeLocale === 'tr' ? '#EFF6FF' : BG, color: activeLocale === 'tr' ? '#2563EB' : MUTED, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>Türkçe kaynak</button>
          {LOCALES.map(([code, label]) => {
            const status = form.translations?.find((item) => item.languageCode === code)?.status;
            return <button key={code} type="button" onClick={() => setActiveLocale(code)} style={{ border: `1px solid ${activeLocale === code ? '#2563EB' : BORDER}`, borderRadius: '7px', background: activeLocale === code ? '#EFF6FF' : BG, color: activeLocale === code ? '#2563EB' : MUTED, padding: '7px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}{status === 'PUBLISHED' ? ' • ✓' : ''}</button>;
          })}
        </div>

        {activeLocale === 'tr' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Kalkış *</label>
              <input style={inputStyle} placeholder="örn: Taksim" value={form.origin ?? ''} onChange={e => set('origin', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Varış *</label>
              <input style={inputStyle} placeholder="örn: Sabiha Gökçen Havalimanı" value={form.destination ?? ''} onChange={e => set('destination', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', border: `1px solid ${BORDER}`, borderRadius: '8px', background: '#F8FAFC' }}>
            <div>
              <label style={labelStyle}>Doğrulanmış Kalkış Lokasyonu</label>
              <select style={inputStyle} value={form.originLocationId ?? ''} onChange={e => set('originLocationId', e.target.value || null)}>
                <option value="">Yalnızca mevcut metin rotası</option>
                {locationOptions.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Doğrulanmış Varış Lokasyonu</label>
              <select style={inputStyle} value={form.destinationLocationId ?? ''} onChange={e => set('destinationLocationId', e.target.value || null)}>
                <option value="">Yalnızca mevcut metin rotası</option>
                {locationOptions.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
              </select>
            </div>
            <p style={{ gridColumn: '1 / -1', color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, margin: 0 }}>
              İki doğrulanmış lokasyonu birlikte seçin. Tanımlı rota mesafesi bu kimlik çifti için öncelikli olur; boş bırakırsanız mevcut metin tabanlı rota korunur.
            </p>
          </div>

          {/* Distance / Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {numField('distanceKm', 'Mesafe (km)')}
            {numField('durationMinutes', 'Süre (dakika)')}
          </div>

          {/* Vito prices */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Mercedes Vito Fiyat Aralığı (EUR)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {numField('priceVitoMinEur', 'Min EUR')}
              {numField('priceVitoMaxEur', 'Max EUR')}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>SEO Başlığı</label><input style={inputStyle} value={form.seoTitle ?? ''} onChange={e => set('seoTitle', e.target.value)} /></div>
            <div><label style={labelStyle}>İlgili Hizmet Slug&apos;ı</label><input style={inputStyle} placeholder="vip-transfer" value={form.relatedServiceSlug ?? ''} onChange={e => set('relatedServiceSlug', e.target.value)} /></div>
          </div>
          <div><label style={labelStyle}>SEO Açıklaması</label><textarea style={{ ...inputStyle, minHeight: '66px', resize: 'vertical' }} value={form.seoDescription ?? ''} onChange={e => set('seoDescription', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Open Graph Başlığı</label><input style={inputStyle} value={form.ogTitle ?? ''} onChange={e => set('ogTitle', e.target.value)} /></div>
            <div><label style={labelStyle}>Open Graph Açıklaması</label><input style={inputStyle} value={form.ogDescription ?? ''} onChange={e => set('ogDescription', e.target.value)} /></div>
          </div>

          {/* Sprinter prices */}
          <div>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Mercedes Sprinter Fiyat Aralığı (EUR)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {numField('priceSprinterMinEur', 'Min EUR')}
              {numField('priceSprinterMaxEur', 'Max EUR')}
            </div>
          </div>

          {/* Image path */}
          <div>
            <label style={labelStyle}>Görsel Yolu</label>
            <input style={inputStyle} placeholder="/route-images/taksim-sabiha.jpg" value={form.imagePath ?? ''} onChange={e => set('imagePath', e.target.value)} />
            <p style={{ color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>public/ klasöründeki görsel dosyasının yolu. Örn: /route-images/taksim-sabiha.jpg</p>
          </div>

          {/* Display order + active */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            {numField('displayOrder', 'Sıra')}
            <div>
              <label style={labelStyle}>Durum</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: TEXT, padding: '8px 0' }}>
                <input type="checkbox" checked={form.active ?? true} onChange={e => set('active', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Aktif (ana sayfada göster)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: TEXT, padding: '3px 0' }}>
                <input type="checkbox" checked={form.indexable ?? true} onChange={e => set('indexable', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Arama motorlarında indekslenebilir
              </label>
            </div>
          </div>
        </div> : !form.id ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: '#F8FAFC', color: MUTED, fontSize: '13px', lineHeight: 1.6 }}>Önce Türkçe rotayı kaydedin. Ardından her dil için sayfa metnini ekleyip yayın durumunu seçebilirsiniz.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, padding: '12px', borderRadius: '8px', color: MUTED, fontSize: '12px', lineHeight: 1.55 }}>Bu sayfa yalnızca <strong>PUBLISHED</strong> durumuna getirildiğinde ziyaretçilere, sitemap&apos;e ve hreflang etiketlerine eklenir. Eksik çeviri Türkçe metne düşmez.</div>
            <div><label style={labelStyle}>Başlık *</label><input style={inputStyle} value={translation?.title ?? ''} onChange={e => setTranslation('title', e.target.value)} /></div>
            <div><label style={labelStyle}>Sayfa Açıklaması *</label><textarea dir={activeLocale === 'ar' ? 'rtl' : 'ltr'} style={{ ...inputStyle, minHeight: '112px', resize: 'vertical' }} value={translation?.description ?? ''} onChange={e => setTranslation('description', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>SEO Başlığı</label><input style={inputStyle} value={translation?.seoTitle ?? ''} onChange={e => setTranslation('seoTitle', e.target.value)} /></div>
              <div><label style={labelStyle}>Yayın Durumu</label><select style={inputStyle} value={translation?.status ?? 'DRAFT'} onChange={e => setTranslation('status', e.target.value)}><option value="DRAFT">Taslak</option><option value="REVIEW">İncelemede</option><option value="APPROVED">Onaylandı</option><option value="PUBLISHED">Yayında</option><option value="OUTDATED">Güncellenecek</option></select></div>
            </div>
            <div><label style={labelStyle}>SEO Açıklaması</label><textarea style={{ ...inputStyle, minHeight: '66px', resize: 'vertical' }} value={translation?.seoDescription ?? ''} onChange={e => setTranslation('seoDescription', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>Open Graph Başlığı</label><input style={inputStyle} value={translation?.ogTitle ?? ''} onChange={e => setTranslation('ogTitle', e.target.value)} /></div>
              <div><label style={labelStyle}>Open Graph Açıklaması</label><input style={inputStyle} value={translation?.ogDescription ?? ''} onChange={e => setTranslation('ogDescription', e.target.value)} /></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} disabled={saving} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: 'pointer', padding: '9px 20px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>İptal</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.origin || !form.destination}
            style={{ background: '#2563EB', border: 'none', borderRadius: '8px', color: '#FFFFFF', cursor: saving ? 'wait' : 'pointer', padding: '9px 20px', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}
          >
            <Check size={14} />
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

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/transfer-routes');
      if (!res.ok) throw new Error('API hatası');
      const json = await res.json();
      setRoutes(json.routes ?? []);
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

  function formatDuration(min: number) {
    if (min < 60) return `${min} dk`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
  }

  return (
    <div>
      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={() => setModal({ ...EMPTY })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={15} />
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: '#F8FAFC' }}>
                  {['Görsel', 'Güzergah', 'Mesafe / Süre', 'Vito (€)', 'Sprinter (€)', 'Sıra', 'Durum', 'İşlem'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid #EDF2F7` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Image */}
                    <td style={{ padding: '10px 12px' }}>
                      {r.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imagePath} alt={r.name} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: '#EDF2F7' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: '60px', height: '40px', background: '#EDF2F7', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🗺️</div>
                      )}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '10px 12px', maxWidth: '240px' }}>
                      <div style={{ color: TEXT, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ color: MUTED, fontSize: '11px', marginTop: '2px' }}>{r.origin} → {r.destination}</div>
                    </td>

                    {/* Distance / Duration */}
                    <td style={{ padding: '10px 12px', color: MUTED, whiteSpace: 'nowrap' }}>
                      <div>{r.distanceKm} km</div>
                      <div style={{ fontSize: '11px' }}>{formatDuration(r.durationMinutes)}</div>
                    </td>

                    {/* Vito price */}
                    <td style={{ padding: '10px 12px', color: TEXT, whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {r.priceVitoMinEur}–{r.priceVitoMaxEur}
                    </td>

                    {/* Sprinter price */}
                    <td style={{ padding: '10px 12px', color: TEXT, whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {r.priceSprinterMinEur}–{r.priceSprinterMaxEur}
                    </td>

                    {/* Display order */}
                    <td style={{ padding: '10px 12px', color: MUTED }}>{r.displayOrder}</td>

                    {/* Status */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: r.active ? '#F0FDF4' : '#FEF2F2', color: r.active ? '#16A34A' : '#D64545', border: `1px solid ${r.active ? '#BBF7D0' : '#FECACA'}` }}>
                        {r.active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setModal({ ...r })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', background: '#EFF6FF', border: 'none', color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <Pencil size={12} /> Düzenle
                        </button>
                        <button
                          onClick={() => setConfirmDelete(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#D64545', fontSize: '12px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <Trash2 size={12} /> Sil
                        </button>
                      </div>
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
