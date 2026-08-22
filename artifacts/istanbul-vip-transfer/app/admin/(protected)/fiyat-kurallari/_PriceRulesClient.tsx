'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

const CARD = '#FFFFFF';
const BORDER = '#D8E1E9';
const NAVY = '#172B3A';
const MUTED = '#52697A';
const BLUE = '#2563EB';
const RED = '#D64545';

type RouteOption = { id: string; name: string; active: boolean };
type VehicleOption = { id: string; name: string; status: string };
type Rule = {
  id: string;
  routeId: string;
  vehicleId: string;
  amountCents: number;
  currency: string;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  notes: string | null;
  updatedAt: string;
  routeName: string;
  routeSlug: string;
  vehicleName: string;
  vehicleSlug: string;
};

type RuleForm = {
  routeId: string;
  vehicleId: string;
  amount: string;
  currency: string;
  active: boolean;
  validFrom: string;
  validUntil: string;
  notes: string;
};

const EMPTY_FORM: RuleForm = {
  routeId: '', vehicleId: '', amount: '', currency: 'EUR', active: true,
  validFrom: '', validUntil: '', notes: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '7px',
  color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '9px 11px',
  outline: 'none', boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', color: MUTED, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px', fontFamily: 'Inter, sans-serif' }}>{children}</label>;
}

function dateValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function toIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
}

function amountToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
      <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} style={{ width: '42px', height: '23px', border: 'none', borderRadius: '14px', position: 'relative', cursor: 'pointer', background: checked ? BLUE : '#CBD5E0', padding: 0 }}>
        <span style={{ position: 'absolute', top: '3px', left: checked ? '22px' : '3px', width: '17px', height: '17px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <span style={{ color: NAVY, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{label}</span>
    </label>
  );
}

function RuleModal({
  rule,
  routes,
  vehicles,
  onClose,
  onSaved,
}: {
  rule: Rule | null;
  routes: RouteOption[];
  vehicles: VehicleOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<RuleForm>(() => rule ? {
    routeId: rule.routeId,
    vehicleId: rule.vehicleId,
    amount: (rule.amountCents / 100).toFixed(2),
    currency: rule.currency,
    active: rule.active,
    validFrom: dateValue(rule.validFrom),
    validUntil: dateValue(rule.validUntil),
    notes: rule.notes ?? '',
  } : EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setError('');
    const amountCents = amountToMinor(form.amount);
    if (!form.routeId || !form.vehicleId || amountCents === null) {
      setError('Güzergah, araç ve geçerli bir pozitif tutar zorunludur.');
      return;
    }
    if (form.validFrom && form.validUntil && form.validFrom > form.validUntil) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(rule ? `/admin/api/price-rules/${rule.id}` : '/admin/api/price-rules', {
        method: rule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: form.routeId,
          vehicleId: form.vehicleId,
          amountCents,
          currency: form.currency,
          active: form.active,
          validFrom: toIso(form.validFrom),
          validUntil: toIso(form.validUntil, true),
          notes: form.notes.trim() || null,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? 'Fiyat kuralı kaydedilemedi.');
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(23,43,58,0.48)', backdropFilter: 'blur(4px)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, width: '100%', maxWidth: '610px', borderRadius: '14px', padding: '26px', boxShadow: '0 16px 48px rgba(23,43,58,0.2)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: NAVY, fontFamily: 'Inter, sans-serif', fontSize: '16px', margin: 0 }}>{rule ? 'Fiyat Kuralını Düzenle' : 'Yeni Fiyat Kuralı'}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', display: 'flex' }}><X size={19} /></button>
        </div>
        {error && <div role="alert" style={{ marginBottom: '14px', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '8px', padding: '10px 12px', color: RED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Güzergah</Label>
            <select value={form.routeId} onChange={(event) => set('routeId', event.target.value)} style={inputStyle}>
              <option value="">Güzergah seçin</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}{route.active ? '' : ' (pasif)'}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Araç</Label>
            <select value={form.vehicleId} onChange={(event) => set('vehicleId', event.target.value)} style={inputStyle}>
              <option value="">Araç seçin</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}{vehicle.status === 'PUBLISHED' ? '' : ` (${vehicle.status})`}</option>)}
            </select>
          </div>
          <div>
            <Label>Tahmini Tutar</Label>
            <input inputMode="decimal" placeholder="125.00" value={form.amount} onChange={(event) => set('amount', event.target.value)} style={inputStyle} />
          </div>
          <div>
            <Label>Para Birimi</Label>
            <select value={form.currency} onChange={(event) => set('currency', event.target.value)} style={inputStyle}>
              <option value="EUR">EUR (€)</option>
              <option value="TRY">TRY (₺)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
          <div>
            <Label>Geçerlilik Başlangıcı</Label>
            <input type="date" value={form.validFrom} onChange={(event) => set('validFrom', event.target.value)} style={inputStyle} />
          </div>
          <div>
            <Label>Geçerlilik Bitişi</Label>
            <input type="date" value={form.validUntil} onChange={(event) => set('validUntil', event.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Yönetim Notu (ziyaretçilere gösterilmez)</Label>
            <textarea rows={3} value={form.notes} onChange={(event) => set('notes', event.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Toggle checked={form.active} onChange={(value) => set('active', value)} label="Kural etkin" />
          </div>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: '12px', color: MUTED, fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>Etkin kurallarda aynı rota ve araç için geçerlilik dönemleri çakışamaz. Tutar, para biriminin en küçük birimi olarak güvenle saklanır.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${BORDER}`, background: CARD, borderRadius: '8px', color: MUTED, padding: '9px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>İptal</button>
          <button type="button" disabled={saving} onClick={save} style={{ border: 'none', background: BLUE, borderRadius: '8px', color: '#FFFFFF', padding: '9px 16px', cursor: saving ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Check size={15} />{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PriceRulesClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingState, setChangingState] = useState(false);
  const [modalRule, setModalRule] = useState<Rule | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rulesResponse, stateResponse] = await Promise.all([
        fetch('/admin/api/price-rules'),
        fetch('/admin/api/price-calculator'),
      ]);
      if (!rulesResponse.ok || !stateResponse.ok) throw new Error('load');
      const [rulesData, stateData] = await Promise.all([rulesResponse.json(), stateResponse.json()]);
      setRules(rulesData.rules ?? []);
      setRoutes(rulesData.routes ?? []);
      setVehicles(rulesData.vehicles ?? []);
      setEnabled(stateData.settings?.enabled === true);
    } catch {
      setError('Fiyat kuralları yüklenemedi. Lütfen sayfayı yenileyin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeRuleCount = useMemo(() => rules.filter((rule) => rule.active).length, [rules]);

  async function setFeatureEnabled(nextEnabled: boolean) {
    const confirmation = nextEnabled
      ? 'Tahmini fiyat API erişimi açılacak. Ziyaretçiler için henüz bir hesaplayıcı arayüzü eklenmemiştir. Devam edilsin mi?'
      : 'Tahmini fiyat API erişimi kapatılacak. Devam edilsin mi?';
    if (!window.confirm(confirmation)) return;
    setChangingState(true);
    setError('');
    try {
      const response = await fetch('/admin/api/price-calculator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? 'update');
      setEnabled(json.settings.enabled === true);
    } catch {
      setError('Özellik bayrağı güncellenemedi.');
    } finally {
      setChangingState(false);
    }
  }

  async function removeRule(rule: Rule) {
    if (!window.confirm(`"${rule.routeName}" / "${rule.vehicleName}" fiyat kuralı silinsin mi?`)) return;
    setError('');
    try {
      const response = await fetch(`/admin/api/price-rules/${rule.id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? 'delete');
      await load();
    } catch {
      setError('Fiyat kuralı silinemedi.');
    }
  }

  return (
    <div>
      <section style={{ marginBottom: '22px', padding: '18px 20px', borderRadius: '12px', border: `1px solid ${enabled ? '#FCD34D' : '#BFDBFE'}`, background: enabled ? '#FFFBEB' : '#EFF6FF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: NAVY, fontFamily: 'Inter, sans-serif', fontSize: '15px' }}>{enabled ? 'Tahmini fiyat API erişimi açık' : 'Hesaplayıcı kapalı — varsayılan güvenli durum'}</h2>
            <p style={{ margin: '6px 0 0', color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.55, maxWidth: '730px' }}>Bu sayfa yalnızca fiyat altyapısını yönetir. Ziyaretçi sayfalarında, navigasyonda, rezervasyon formunda ve chatbotta hesaplayıcı gösterilmez. Bayrak kapalıyken public tahmin isteği de `FEATURE_DISABLED` ile kapatılır.</p>
          </div>
          <button type="button" disabled={changingState} onClick={() => void setFeatureEnabled(!enabled)} style={{ border: 'none', borderRadius: '8px', background: enabled ? '#B45309' : BLUE, color: '#FFFFFF', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '13px', cursor: changingState ? 'wait' : 'pointer', opacity: changingState ? 0.7 : 1 }}>{enabled ? 'API erişimini kapat' : 'API erişimini aç'}</button>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{activeRuleCount} etkin / {rules.length} toplam kural</p>
        <button type="button" onClick={() => setModalRule(null)} style={{ border: 'none', borderRadius: '8px', background: BLUE, color: '#FFFFFF', padding: '9px 14px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Plus size={16} />Yeni fiyat kuralı</button>
      </div>
      {error && <div role="alert" style={{ marginBottom: '14px', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '8px', padding: '11px 13px', color: RED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>}
      {loading ? <p style={{ color: MUTED, fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '36px 0', textAlign: 'center' }}>Yükleniyor…</p> : rules.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '48px 24px', textAlign: 'center', color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Henüz fiyat kuralı yok. Hesaplayıcı kapalı kalırken kuralları güvenle hazırlayabilirsiniz.</div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            <thead><tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${BORDER}` }}>{['Güzergah', 'Araç', 'Tahmini Tutar', 'Geçerlilik', 'Durum', 'İşlem'].map((heading) => <th key={heading} style={{ padding: '11px 13px', textAlign: 'left', color: MUTED, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{heading}</th>)}</tr></thead>
            <tbody>{rules.map((rule) => (
              <tr key={rule.id} style={{ borderBottom: `1px solid #EDF2F7` }}>
                <td style={{ padding: '12px 13px', color: NAVY, fontWeight: 600 }}>{rule.routeName}</td>
                <td style={{ padding: '12px 13px', color: NAVY }}>{rule.vehicleName}</td>
                <td style={{ padding: '12px 13px', color: NAVY, fontWeight: 700 }}>{formatMoney(rule.amountCents, rule.currency)}</td>
                <td style={{ padding: '12px 13px', color: MUTED }}>{rule.validFrom ? dateValue(rule.validFrom) : 'Hemen'} — {rule.validUntil ? dateValue(rule.validUntil) : 'Süresiz'}</td>
                <td style={{ padding: '12px 13px' }}><span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: rule.active ? '#ECFDF5' : '#FEF2F2', color: rule.active ? '#166534' : RED }}>{rule.active ? 'Etkin' : 'Pasif'}</span></td>
                <td style={{ padding: '12px 13px' }}><div style={{ display: 'flex', gap: '6px' }}><button type="button" onClick={() => setModalRule(rule)} aria-label="Düzenle" style={{ border: 'none', borderRadius: '6px', color: BLUE, background: '#EFF6FF', padding: '6px 8px', cursor: 'pointer' }}><Pencil size={14} /></button><button type="button" onClick={() => void removeRule(rule)} aria-label="Sil" style={{ border: '1px solid #FECACA', borderRadius: '6px', color: RED, background: '#FEF2F2', padding: '6px 8px', cursor: 'pointer' }}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {modalRule !== undefined && <RuleModal rule={modalRule} routes={routes} vehicles={vehicles} onClose={() => setModalRule(undefined)} onSaved={load} />}
    </div>
  );
}