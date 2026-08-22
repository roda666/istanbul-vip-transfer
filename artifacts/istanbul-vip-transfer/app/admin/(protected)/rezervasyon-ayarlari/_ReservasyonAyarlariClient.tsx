'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Archive, Trash2, Search, RefreshCw, Check, X, GripVertical } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#C99A32';
const NAVY = '#172B3A';
const MUTED = '#52697A';
const BORDER = '#D8E1E9';
const BG = '#F3F6FA';
const CARD = '#FFFFFF';
const BLUE = '#2563EB';
const RED = '#D64545';

// ── Types ─────────────────────────────────────────────────────────────────────
type LocationType = 'AIRPORT' | 'DISTRICT' | 'REGION' | 'HOTEL_ZONE' | 'CUSTOM' | 'PROVINCE';
type LocationScope = 'LOCAL' | 'INTERCITY' | 'BOTH';

interface Location {
  id: string;
  name: string;
  slug: string;
  city: string;
  district: string | null;
  type: LocationType;
  scope: LocationScope;
  pickupEnabled: boolean;
  dropoffEnabled: boolean;
  isActive: boolean;
  displayOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormSettings {
  timeStepMinutes: number;
  exactAddressRequired: boolean;
  locationSearchEnabled: boolean;
  showLuggageCount:      boolean;
  showChildSeatCount:    boolean;
  showVehiclePreference: boolean;
  showAdditionalNotes:   boolean;
}

interface CustomField {
  id: number;
  label: string;
  appliesToSlugs: string[];
  fieldType: string;
  isActive: boolean;
  sortOrder: number;
}

interface ServiceTypeItem {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  quoteEnabled: boolean;
  reservationEnabled: boolean;
  displayOrder: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<LocationType, string> = {
  AIRPORT: 'Havalimanı',
  DISTRICT: 'İlçe',
  REGION: 'Bölge',
  HOTEL_ZONE: 'Otel Bölgesi',
  CUSTOM: 'Özel',
  PROVINCE: 'İl',
};

const SCOPE_LABELS: Record<LocationScope, string> = {
  LOCAL: 'Şehir İçi',
  INTERCITY: 'Şehirler Arası',
  BOTH: 'Her İkisi',
};

const TYPE_COLORS: Record<LocationType, { bg: string; color: string }> = {
  AIRPORT: { bg: '#EBF4FF', color: '#1D5FD1' },
  DISTRICT: { bg: '#ECFDF5', color: '#065F46' },
  REGION: { bg: '#FFF7ED', color: '#9A3412' },
  HOTEL_ZONE: { bg: '#F5F3FF', color: '#4C1D95' },
  CUSTOM: { bg: '#F1F5F9', color: '#334155' },
  PROVINCE: { bg: '#FEF9EE', color: '#92400E' },
};

const SCOPE_COLORS: Record<LocationScope, { bg: string; color: string }> = {
  LOCAL: { bg: '#EBF4FF', color: '#1D5FD1' },
  INTERCITY: { bg: '#F0FDF4', color: '#166534' },
  BOTH: { bg: '#F5F3FF', color: '#4C1D95' },
};

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '5px', fontWeight: 600 }}>
      {children}{required && <span style={{ color: RED, marginLeft: '3px' }}>*</span>}
    </label>
  );
}

function FieldInput({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '6px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '8px 12px', outline: 'none', boxSizing: 'border-box', opacity: disabled ? 0.5 : 1 }} />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{ width: '40px', height: '22px', borderRadius: '11px', position: 'relative', flexShrink: 0, cursor: 'pointer', background: checked ? BLUE : '#CBD5E0', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <span style={{ color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{label}</span>
    </label>
  );
}

function Btn({ onClick, loading, disabled, variant, children, small }: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; variant: 'primary' | 'secondary' | 'danger' | 'ghost'; children: React.ReactNode; small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: BLUE, color: '#fff', fontWeight: 600 },
    secondary: { background: 'transparent', color: BLUE, border: `1px solid ${BLUE}`, fontWeight: 500 },
    danger: { background: '#FEF2F2', color: RED, border: '1px solid #FECACA', fontWeight: 500 },
    ghost: { background: '#F1F5F9', color: MUTED, fontWeight: 400 },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: small ? '5px 12px' : '8px 18px', borderRadius: '8px', border: 'none', fontSize: small ? '12px' : '13px', fontFamily: 'Inter, sans-serif', cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: disabled || loading ? 0.6 : 1, transition: 'opacity 0.15s', ...styles[variant] }}>
      {children}
    </button>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,43,58,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 8px 32px rgba(23,43,58,0.15)' }}>
        <h3 style={{ color: NAVY, fontSize: '16px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: '0 0 10px' }}>{title}</h3>
        <p style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onCancel}>Vazgeç</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Location Modal ─────────────────────────────────────────────────────────────
interface LocationFormState {
  name: string; slug: string; city: string; district: string;
  type: LocationType; scope: LocationScope;
  pickupEnabled: boolean; dropoffEnabled: boolean;
  isActive: boolean; displayOrder: string;
}

const EMPTY_FORM: LocationFormState = {
  name: '', slug: '', city: 'İstanbul', district: '', type: 'DISTRICT', scope: 'LOCAL',
  pickupEnabled: true, dropoffEnabled: true, isActive: true, displayOrder: '0',
};

function locationToForm(loc: Location): LocationFormState {
  return {
    name: loc.name, slug: loc.slug, city: loc.city, district: loc.district ?? '',
    type: loc.type, scope: loc.scope,
    pickupEnabled: loc.pickupEnabled, dropoffEnabled: loc.dropoffEnabled,
    isActive: loc.isActive, displayOrder: String(loc.displayOrder),
  };
}

function LocationModal({ loc, onSave, onClose }: { loc?: Location; onSave: () => void; onClose: () => void }) {
  const isEdit = !!loc;
  const [form, setForm] = useState<LocationFormState>(loc ? locationToForm(loc) : EMPTY_FORM);
  const [slugManual, setSlugManual] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof LocationFormState>(k: K, v: LocationFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleNameChange(v: string) {
    setForm(f => ({ ...f, name: v, slug: slugManual ? f.slug : slugify(v) }));
  }

  async function handleSave() {
    setError('');
    if (!form.pickupEnabled && !form.dropoffEnabled) {
      setError('En az biri etkin olmalıdır: Alış veya Bırakış.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name, slug: form.slug, city: form.city, district: form.district || null,
      type: form.type, scope: form.scope,
      pickupEnabled: form.pickupEnabled, dropoffEnabled: form.dropoffEnabled,
      isActive: form.isActive, displayOrder: parseInt(form.displayOrder, 10) || 0,
    };
    const url = isEdit ? `/admin/api/locations/${loc!.id}` : '/admin/api/locations';
    const method = isEdit ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Bir hata oluştu.'); setSaving(false); return; }
      onSave();
    } catch {
      setError('Bağlantı hatası.');
      setSaving(false);
    }
  }

  const selectStyle: React.CSSProperties = { width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '6px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '8px 12px', outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(23,43,58,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 12px 48px rgba(23,43,58,0.18)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: NAVY, fontSize: '16px', fontFamily: 'Inter, sans-serif', fontWeight: 700, margin: 0 }}>
            {isEdit ? 'Lokasyon Düzenle' : 'Yeni Lokasyon Ekle'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: RED, fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '16px' }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label required>Lokasyon Adı</Label>
            <FieldInput value={form.name} onChange={handleNameChange} placeholder="ör. Kadıköy" />
          </div>
          <div>
            <Label required>Slug</Label>
            <FieldInput value={form.slug} onChange={v => { setSlugManual(true); set('slug', v); }} placeholder="kadikoy" />
          </div>
          <div>
            <Label required>Tip</Label>
            <select value={form.type} onChange={e => set('type', e.target.value as LocationType)} style={selectStyle}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label required>Kapsam</Label>
            <select value={form.scope} onChange={e => set('scope', e.target.value as LocationScope)} style={selectStyle}>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label>Şehir</Label>
            <FieldInput value={form.city} onChange={v => set('city', v)} placeholder="İstanbul" />
          </div>
          <div>
            <Label>İlçe</Label>
            <FieldInput value={form.district} onChange={v => set('district', v)} placeholder="ör. Kadıköy" />
          </div>
          <div>
            <Label>Sıralama</Label>
            <FieldInput value={form.displayOrder} onChange={v => set('displayOrder', v)} type="number" placeholder="0" />
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
          <Toggle checked={form.pickupEnabled} onChange={v => set('pickupEnabled', v)} label="Alış (Pickup) Etkin" />
          <Toggle checked={form.dropoffEnabled} onChange={v => set('dropoffEnabled', v)} label="Bırakış (Dropoff) Etkin" />
          <Toggle checked={form.isActive} onChange={v => set('isActive', v)} label="Aktif (Formda Görünsün)" />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="ghost" onClick={onClose}>İptal</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>
            {saving ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Ekle'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Service Type Editor (inline) ───────────────────────────────────────────────
function ServiceTypeRow({ st, onSaved }: { st: ServiceTypeItem; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: st.label, description: st.description ?? '', enabled: st.enabled, quoteEnabled: st.quoteEnabled, reservationEnabled: st.reservationEnabled, displayOrder: String(st.displayOrder) });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/admin/api/service-types/${st.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          description: form.description || null,
          enabled: form.enabled,
          quoteEnabled: form.quoteEnabled,
          reservationEnabled: form.reservationEnabled,
          displayOrder: parseInt(form.displayOrder, 10) || 0,
        }),
      });
      if (!res.ok) { const j = await res.json(); setMsg(j.error ?? 'Hata oluştu.'); }
      else { setMsg('Kaydedildi.'); setEditing(false); onSaved(); }
    } catch { setMsg('Bağlantı hatası.'); }
    setSaving(false);
  }

  const inputS: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '6px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '18px 20px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: NAVY }}>{st.label}</span>
            <span style={{ background: '#F1F5F9', color: MUTED, fontSize: '11px', padding: '1px 7px', borderRadius: '10px', fontFamily: 'Inter, sans-serif' }}>{st.key}</span>
            {!st.enabled && <span style={{ background: '#FEF2F2', color: RED, fontSize: '11px', padding: '1px 7px', borderRadius: '10px', fontFamily: 'Inter, sans-serif' }}>Devre Dışı</span>}
            {st.enabled && <span style={{ background: '#ECFDF5', color: '#065F46', fontSize: '11px', padding: '1px 7px', borderRadius: '10px', fontFamily: 'Inter, sans-serif' }}>Aktif</span>}
          </div>
          {st.description && <p style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '4px', marginBottom: 0 }}>{st.description}</p>}
        </div>
        <button onClick={() => { setEditing(e => !e); setMsg(''); }}
          style={{ background: editing ? '#EEF3F9' : '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: BLUE, fontSize: '12px', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <Pencil size={12} /> {editing ? 'Kapat' : 'Düzenle'}
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <Label>Görünen Ad</Label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputS} />
            </div>
            <div>
              <Label>Sıralama</Label>
              <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} style={{ ...inputS, maxWidth: '100px' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Açıklama (opsiyonel)</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputS, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
            <Toggle checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} label="Hizmet Türü Etkin (Formda Göster)" />
            <Toggle checked={form.quoteEnabled} onChange={v => setForm(f => ({ ...f, quoteEnabled: v }))} label="Fiyat Teklifi Almaya İzin Ver" />
            <Toggle checked={form.reservationEnabled} onChange={v => setForm(f => ({ ...f, reservationEnabled: v }))} label="Rezervasyon Talebine İzin Ver" />
          </div>
          {msg && (
            <div style={{ background: msg === 'Kaydedildi.' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${msg === 'Kaydedildi.' ? '#86EFAC' : '#FECACA'}`, borderRadius: '8px', padding: '8px 12px', color: msg === 'Kaydedildi.' ? '#065F46' : RED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>{msg}</div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setEditing(false); setMsg(''); }}>İptal</Btn>
            <Btn variant="primary" loading={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ReservasyonAyarlariClient() {
  const [tab, setTab] = useState<'lokasyonlar' | 'hizmet-turleri' | 'form-ayarlari' | 'ozel-alanlar'>('lokasyonlar');

  // ── Lokasyonlar state ──
  const [items, setItems] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalLoc, setModalLoc] = useState<Location | 'new' | null>(null);
  const [confirm, setConfirm] = useState<{ loc: Location; action: 'archive' | 'delete' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Hizmet Türleri state ──
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeItem[]>([]);
  const [stLoading, setStLoading] = useState(true);

  // ── Form Ayarları state ──
  const [settings, setSettings] = useState<FormSettings>({ timeStepMinutes: 5, exactAddressRequired: false, locationSearchEnabled: true, showLuggageCount: false, showChildSeatCount: false, showVehiclePreference: false, showAdditionalNotes: false });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Özel Alanlar state ──
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfSaving, setCfSaving] = useState<number | 'new' | null>(null);
  const [cfMsg, setCfMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cfForm, setCfForm] = useState<{ label: string; appliesToSlugs: string; fieldType: string } | null>(null);
  const [cfEditId, setCfEditId] = useState<number | 'new' | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '300' });
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    if (scopeFilter) params.set('scope', scopeFilter);
    try {
      const res = await fetch(`/admin/api/locations?${params}`);
      const json = await res.json();
      const all: Location[] = json.items ?? [];
      const visible = showArchived ? all : all.filter(l => !l.archivedAt);
      setItems(visible);
      setTotal(json.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, typeFilter, scopeFilter, showArchived]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  async function fetchServiceTypes() {
    setStLoading(true);
    try {
      const res = await fetch('/admin/api/service-types');
      const json = await res.json();
      if (json.items) setServiceTypes(json.items);
    } catch { /* ignore */ }
    setStLoading(false);
  }

  useEffect(() => { fetchServiceTypes(); }, []);

  async function fetchSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch('/admin/api/reservation-settings');
      const json = await res.json();
      if (json.settings) setSettings(json.settings);
    } catch { /* ignore */ }
    setSettingsLoading(false);
  }

  useEffect(() => { fetchSettings(); }, []);

  async function fetchCustomFields() {
    setCfLoading(true);
    try {
      const res = await fetch('/admin/api/custom-fields');
      const json = await res.json();
      if (Array.isArray(json.fields)) setCustomFields(json.fields);
    } catch { /* ignore */ }
    setCfLoading(false);
  }

  useEffect(() => { fetchCustomFields(); }, []);

  async function saveCustomField() {
    if (!cfForm) return;
    const isNew = cfEditId === 'new';
    setCfSaving(cfEditId);
    setCfMsg(null);
    try {
      const payload = {
        label: cfForm.label.trim(),
        appliesToSlugs: cfForm.appliesToSlugs.split(',').map(s => s.trim()).filter(Boolean),
        fieldType: cfForm.fieldType,
        isActive: true,
      };
      const url = isNew ? '/admin/api/custom-fields' : `/admin/api/custom-fields/${cfEditId}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { setCfMsg({ type: 'error', text: json.error ?? 'Hata oluştu.' }); }
      else { setCfMsg({ type: 'success', text: isNew ? 'Alan oluşturuldu.' : 'Alan güncellendi.' }); setCfEditId(null); setCfForm(null); await fetchCustomFields(); }
    } catch { setCfMsg({ type: 'error', text: 'Bağlantı hatası.' }); }
    setCfSaving(null);
  }

  async function deleteCustomField(id: number) {
    if (!window.confirm('Bu alanı silmek istediğinizden emin misiniz?')) return;
    setCfSaving(id);
    try {
      await fetch(`/admin/api/custom-fields/${id}`, { method: 'DELETE' });
      await fetchCustomFields();
    } catch { /* ignore */ }
    setCfSaving(null);
  }

  async function toggleCustomFieldActive(field: CustomField) {
    try {
      await fetch(`/admin/api/custom-fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !field.isActive }),
      });
      await fetchCustomFields();
    } catch { /* ignore */ }
  }

  async function handleArchiveOrDelete(loc: Location) {
    setActionLoading(loc.id);
    try {
      const res = await fetch(`/admin/api/locations/${loc.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? 'Hata oluştu.'); }
      else { await fetchLocations(); }
    } catch { alert('Bağlantı hatası.'); }
    setActionLoading(null);
    setConfirm(null);
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const res = await fetch('/admin/api/reservation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) { setSettingsMsg({ type: 'error', text: json.error ?? 'Hata oluştu.' }); }
      else { setSettingsMsg({ type: 'success', text: 'Ayarlar kaydedildi.' }); if (json.settings) setSettings(json.settings); }
    } catch { setSettingsMsg({ type: 'error', text: 'Bağlantı hatası.' }); }
    setSettingsSaving(false);
  }

  const TABS = [
    ['lokasyonlar', 'Lokasyonlar'],
    ['hizmet-turleri', 'Hizmet Türleri'],
    ['form-ayarlari', 'Form Ayarları'],
    ['ozel-alanlar', 'Özel Alanlar'],
  ] as const;

  return (
    <div style={{ padding: '28px 24px', minHeight: '100vh', background: BG }}>
      <AdminPageHeader title="Rezervasyon Ayarları" description="Lokasyonları, hizmet türlerini ve form ayarlarını yönetin" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#E2E8F0', borderRadius: '10px', padding: '4px', width: 'fit-content', marginBottom: '24px' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: tab === key ? 600 : 400, background: tab === key ? CARD : 'transparent', color: tab === key ? NAVY : MUTED, boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Lokasyonlar Tab ── */}
      {tab === 'lokasyonlar' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Lokasyon ara…"
                style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
              <option value="">Tüm Tipler</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}
              style={{ padding: '8px 12px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
              <option value="">Tüm Kapsamlar</option>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
              Arşivlenenleri Göster
            </label>
            <Btn variant="ghost" onClick={fetchLocations} small><RefreshCw size={13} /></Btn>
            <Btn variant="primary" onClick={() => setModalLoc('new')} small><Plus size={13} /> Yeni Lokasyon</Btn>
          </div>

          <p style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
            {items.length} lokasyon {total > items.length ? `(toplam ${total})` : ''}
          </p>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Lokasyon bulunamadı.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${BORDER}` }}>
                      {['Ad', 'Tip', 'Kapsam', 'Alış', 'Bırakış', 'Aktif', 'Sıra', 'Güncelleme', ''].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((loc, i) => {
                      const tc = TYPE_COLORS[loc.type] ?? TYPE_COLORS.CUSTOM;
                      const sc = SCOPE_COLORS[loc.scope] ?? SCOPE_COLORS.LOCAL;
                      const isArchived = !!loc.archivedAt;
                      return (
                        <tr key={loc.id} style={{ borderBottom: i < items.length - 1 ? `1px solid #F0F4F8` : 'none', opacity: isArchived ? 0.55 : 1 }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{loc.name}</div>
                            <div style={{ color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>{loc.slug}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: tc.bg, color: tc.color, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {TYPE_LABELS[loc.type]}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: sc.bg, color: sc.color, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {SCOPE_LABELS[loc.scope]}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {loc.pickupEnabled ? <Check size={14} color="#065F46" /> : <X size={14} color="#9CA3AF" />}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {loc.dropoffEnabled ? <Check size={14} color="#065F46" /> : <X size={14} color="#9CA3AF" />}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {loc.isActive
                              ? <span style={{ background: '#ECFDF5', color: '#065F46', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Aktif</span>
                              : <span style={{ background: '#F1F5F9', color: MUTED, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Pasif</span>}
                            {isArchived && <span style={{ marginLeft: '4px', background: '#FEF2F2', color: RED, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Arşiv</span>}
                          </td>
                          <td style={{ padding: '10px 14px', color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>{loc.displayOrder}</td>
                          <td style={{ padding: '10px 14px', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                            {new Date(loc.updatedAt).toLocaleDateString('tr-TR')}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {!isArchived && (
                                <button onClick={() => setModalLoc(loc)} title="Düzenle"
                                  style={{ background: '#EEF3F9', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center' }}>
                                  <Pencil size={13} />
                                </button>
                              )}
                              <button onClick={() => setConfirm({ loc, action: isArchived ? 'delete' : 'archive' })}
                                disabled={actionLoading === loc.id} title={isArchived ? 'Kalıcı Sil' : 'Arşivle'}
                                style={{ background: isArchived ? '#FEF2F2' : '#FFF8E1', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: actionLoading === loc.id ? 'not-allowed' : 'pointer', color: isArchived ? RED : '#B45309', display: 'flex', alignItems: 'center', opacity: actionLoading === loc.id ? 0.5 : 1 }}>
                                {isArchived ? <Trash2 size={13} /> : <Archive size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hizmet Türleri Tab ── */}
      {tab === 'hizmet-turleri' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
            <h3 style={{ color: GOLD, fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px', paddingBottom: '12px', borderBottom: `1px solid ${BORDER}` }}>
              Hizmet Türleri
            </h3>
            <p style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '0', marginBottom: '16px' }}>
              Rezervasyon formunda görünen hizmet türlerini yönetin. Sistem anahtarları (key) değiştirilmez.
            </p>
            {stLoading ? (
              <div style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Yükleniyor…</div>
            ) : serviceTypes.map((st) => (
              <ServiceTypeRow key={st.id} st={st} onSaved={fetchServiceTypes} />
            ))}
            {!stLoading && serviceTypes.length === 0 && (
              <div style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '20px', textAlign: 'center' }}>
                Hizmet türü bulunamadı. Veritabanını kontrol edin.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Form Ayarları Tab ── */}
      {tab === 'form-ayarlari' && (
        <div style={{ maxWidth: '540px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '28px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
            <h3 style={{ color: GOLD, fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 20px', paddingBottom: '12px', borderBottom: `1px solid ${BORDER}` }}>
              Rezervasyon Formu Ayarları
            </h3>

            {settingsLoading ? (
              <div style={{ color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor…</div>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div>
                  <Label required>Zaman Adımı (Dakika)</Label>
                  <FieldInput
                    value={String(settings.timeStepMinutes)}
                    onChange={v => setSettings(s => ({ ...s, timeStepMinutes: Math.min(60, Math.max(1, parseInt(v, 10) || 5)) }))}
                    type="number"
                    placeholder="5"
                  />
                  <p style={{ color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '5px' }}>
                    Rezervasyon formundaki dakika seçeneklerinin adımı. Minimum 1, maksimum 60.
                  </p>
                </div>

                <Toggle
                  checked={settings.locationSearchEnabled}
                  onChange={v => setSettings(s => ({ ...s, locationSearchEnabled: v }))}
                  label="Lokasyon Arama Etkin (Formda arama kutusu göster)"
                />
                <Toggle
                  checked={settings.exactAddressRequired}
                  onChange={v => setSettings(s => ({ ...s, exactAddressRequired: v }))}
                  label="Kesin Adres Zorunlu (Adres alanı zorunlu olsun)"
                />

                <div style={{ height: '1px', background: BORDER, margin: '8px 0' }} />
                <p style={{ color: NAVY, fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                  Alan Görünürlüğü
                </p>
                <p style={{ color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '0 0 8px' }}>
                  Rezervasyon formunda opsiyonel alanları gösterin. Varsayılan olarak kapalıdır.
                </p>
                <Toggle
                  checked={settings.showLuggageCount}
                  onChange={v => setSettings(s => ({ ...s, showLuggageCount: v }))}
                  label="Bagaj Sayısı Alanını Göster"
                />
                <Toggle
                  checked={settings.showChildSeatCount}
                  onChange={v => setSettings(s => ({ ...s, showChildSeatCount: v }))}
                  label="Çocuk Koltuğu Sayısı Alanını Göster"
                />
                <Toggle
                  checked={settings.showVehiclePreference}
                  onChange={v => setSettings(s => ({ ...s, showVehiclePreference: v }))}
                  label="Araç Tercihi Seçim Alanını Göster"
                />
                <Toggle
                  checked={settings.showAdditionalNotes}
                  onChange={v => setSettings(s => ({ ...s, showAdditionalNotes: v }))}
                  label="Ek Notlar / Özel İstekler Alanını Göster"
                />

                {settingsMsg && (
                  <div style={{ background: settingsMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${settingsMsg.type === 'success' ? '#86EFAC' : '#FECACA'}`, borderRadius: '8px', padding: '10px 14px', color: settingsMsg.type === 'success' ? '#065F46' : RED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    {settingsMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Btn variant="primary" loading={settingsSaving} onClick={saveSettings}>
                    {settingsSaving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Özel Alanlar Tab ── */}
      {tab === 'ozel-alanlar' && (
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
              Rezervasyon formuna servis bazlı özel alanlar ekleyin. Boş &ldquo;Geçerli Hizmetler&rdquo; = tüm servislerde göster.
            </p>
            <Btn variant="primary" small onClick={() => { setCfEditId('new'); setCfForm({ label: '', appliesToSlugs: '', fieldType: 'checkbox' }); setCfMsg(null); }}>
              <Plus size={13} /> Yeni Alan
            </Btn>
          </div>

          {/* New / Edit form */}
          {cfEditId !== null && cfForm !== null && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
              <h3 style={{ color: GOLD, fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                {cfEditId === 'new' ? 'Yeni Alan Ekle' : 'Alanı Düzenle'}
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <Label required>Alan Etiketi</Label>
                  <FieldInput value={cfForm.label} onChange={v => setCfForm(f => f ? { ...f, label: v } : f)} placeholder="örn: VIP Karşılama Talebi" />
                </div>
                <div>
                  <Label>Alan Türü</Label>
                  <select value={cfForm.fieldType} onChange={e => setCfForm(f => f ? { ...f, fieldType: e.target.value } : f)}
                    style={{ width: '100%', padding: '8px 12px', background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: '8px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
                    <option value="checkbox">Onay Kutusu (checkbox)</option>
                    <option value="text">Metin Girişi (text)</option>
                  </select>
                </div>
                <div>
                  <Label>Geçerli Hizmetler (slug, virgülle ayır — boş = hepsi)</Label>
                  <FieldInput value={cfForm.appliesToSlugs} onChange={v => setCfForm(f => f ? { ...f, appliesToSlugs: v } : f)} placeholder="örn: istanbul-havalimani-transfer,sabiha-gokcen-havalimani-transfer" />
                  <p style={{ color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>Boş bırakırsanız alan tüm rezervasyon formlarında görünür.</p>
                </div>
                {cfMsg && (
                  <div style={{ background: cfMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${cfMsg.type === 'success' ? '#86EFAC' : '#FECACA'}`, borderRadius: '8px', padding: '10px 14px', color: cfMsg.type === 'success' ? '#065F46' : RED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    {cfMsg.text}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => { setCfEditId(null); setCfForm(null); setCfMsg(null); }}>İptal</Btn>
                  <Btn variant="primary" loading={cfSaving !== null} onClick={saveCustomField} disabled={!cfForm.label.trim()}>Kaydet</Btn>
                </div>
              </div>
            </div>
          )}

          {/* Fields list */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(23,43,58,0.06)' }}>
            {cfLoading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor…</div>
            ) : customFields.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                Henüz özel alan eklenmedi. Yukarıdan yeni alan ekleyebilirsiniz.
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${BORDER}` }}>
                    {['Etiket', 'Tür', 'Geçerli Hizmetler', 'Aktif', ''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', textAlign: 'left', color: MUTED, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customFields.map((field, i) => (
                    <tr key={field.id} style={{ borderBottom: i < customFields.length - 1 ? `1px solid #F0F4F8` : 'none' }}>
                      <td style={{ padding: '10px 14px', color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <GripVertical size={13} style={{ color: MUTED, flexShrink: 0 }} />
                          {field.label}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: '#EEF3F9', color: BLUE, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                          {field.fieldType === 'checkbox' ? 'Onay Kutusu' : 'Metin'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                        {field.appliesToSlugs?.length ? field.appliesToSlugs.join(', ') : <em style={{ color: '#9CA3AF' }}>Hepsi</em>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button onClick={() => toggleCustomFieldActive(field)} title={field.isActive ? 'Pasife Al' : 'Aktife Al'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {field.isActive
                            ? <span style={{ background: '#ECFDF5', color: '#065F46', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Aktif</span>
                            : <span style={{ background: '#F1F5F9', color: MUTED, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Pasif</span>}
                        </button>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setCfEditId(field.id); setCfForm({ label: field.label, appliesToSlugs: (field.appliesToSlugs ?? []).join(', '), fieldType: field.fieldType }); setCfMsg(null); }} title="Düzenle"
                            style={{ background: '#EEF3F9', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: BLUE, display: 'flex', alignItems: 'center' }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteCustomField(field.id)} disabled={cfSaving === field.id} title="Sil"
                            style={{ background: '#FEF2F2', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: cfSaving === field.id ? 'not-allowed' : 'pointer', color: RED, display: 'flex', alignItems: 'center', opacity: cfSaving === field.id ? 0.5 : 1 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {modalLoc !== null && (
        <LocationModal
          loc={modalLoc === 'new' ? undefined : modalLoc}
          onSave={() => { setModalLoc(null); fetchLocations(); }}
          onClose={() => setModalLoc(null)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === 'archive' ? 'Lokasyonu Arşivle' : 'Lokasyonu Kalıcı Sil'}
          message={
            confirm.action === 'archive'
              ? `"${confirm.loc.name}" arşivlenecek ve formda görünmeyecek. Daha sonra kalıcı olarak silebilirsiniz.`
              : `"${confirm.loc.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`
          }
          confirmLabel={confirm.action === 'archive' ? 'Arşivle' : 'Kalıcı Sil'}
          danger={confirm.action === 'delete'}
          onConfirm={() => handleArchiveOrDelete(confirm.loc)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
