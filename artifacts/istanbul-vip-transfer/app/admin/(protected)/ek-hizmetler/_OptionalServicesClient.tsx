'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Archive, Edit3, Loader2, PackagePlus, Plus, RefreshCw, Trash2, X } from 'lucide-react';

type OptionalService = {
  id: string; key: string; name: string; currency: 'TRY' | 'EUR' | 'USD'; unitAmount: number;
  chargeType: 'PER_BOOKING' | 'PER_PERSON'; maximumQuantity: number; includedInTransfer: boolean;
  active: boolean; displayOrder: number; archivedAt: string | null;
};
type FormValues = Omit<OptionalService, 'id' | 'archivedAt'>;

const blankForm: FormValues = {
  key: '', name: '', currency: 'TRY', unitAmount: 0, chargeType: 'PER_BOOKING',
  maximumQuantity: 1, includedInTransfer: false, active: true, displayOrder: 0,
};
function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount / 100);
}
function toForm(service: OptionalService): FormValues {
  const { id, archivedAt, ...values } = service;
  void id;
  void archivedAt;
  return values;
}

export default function OptionalServicesClient() {
  const [services, setServices] = useState<OptionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [editing, setEditing] = useState<OptionalService | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/admin/api/ek-hizmetler${showArchived ? '?archived=true' : ''}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as { services?: OptionalService[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Ek hizmetler alınamadı.');
      setServices(payload?.services ?? []);
    } catch (caught) {
      setServices([]); setError(caught instanceof Error ? caught.message : 'Ek hizmetler alınamadı.');
    } finally { setLoading(false); }
  }, [showArchived]);
  useEffect(() => { void loadServices(); }, [loadServices]);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };
  const save = async () => {
    if (!form) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(editing ? `/admin/api/ek-hizmetler/${editing.id}` : '/admin/api/ek-hizmetler', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Hizmet kaydedilemedi.');
      setForm(null); setEditing(null); await loadServices();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Hizmet kaydedilemedi.'); }
    finally { setSaving(false); }
  };
  const remove = async (service: OptionalService) => {
    const permanent = Boolean(service.archivedAt);
    if (!window.confirm(permanent ? `"${service.name}" kalıcı olarak silinsin mi?` : `"${service.name}" arşivlensin mi?`)) return;
    try {
      const response = await fetch(`/admin/api/ek-hizmetler/${service.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'İşlem tamamlanamadı.');
      await loadServices();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.'); }
  };
  const toggleActive = async (service: OptionalService) => {
    try {
      const response = await fetch(`/admin/api/ek-hizmetler/${service.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !service.active }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Durum güncellenemedi.');
      await loadServices();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Durum güncellenemedi.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Arşivdekileri göster
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadServices()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} />Yenile</button>
          <button type="button" onClick={() => { setEditing(null); setForm(blankForm); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"><Plus size={17} />Yeni hizmet</button>
        </div>
      </div>
      {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span className="flex gap-2"><AlertCircle size={18} />{error}</span><button onClick={() => setError(null)} aria-label="Hata mesajını kapat"><X size={17} /></button></div>}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600"><Loader2 size={20} className="inline animate-spin text-blue-600" /> <span className="ml-2 text-sm font-semibold">Ek hizmetler yükleniyor…</span></div>
        : services.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><PackagePlus size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-bold text-slate-900">{showArchived ? 'Arşivlenmiş hizmet yok' : 'Henüz ek hizmet tanımlanmadı'}</p><button type="button" onClick={() => { setEditing(null); setForm(blankForm); }} className="mt-4 text-sm font-bold text-blue-700 hover:underline">İlk hizmeti ekle</button></div>
        : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Hizmet</th><th className="px-5 py-3">Ücret</th><th className="px-5 py-3">Ücretlendirme</th><th className="px-5 py-3">Azami adet</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3 text-right">İşlemler</th></tr></thead><tbody className="divide-y divide-slate-100">{services.map((service) => <tr key={service.id}><td className="px-5 py-4"><p className="font-semibold text-slate-900">{service.name}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{service.key}{service.includedInTransfer ? ' · Transfer fiyatına dahil' : ''}</p></td><td className="px-5 py-4 font-semibold text-slate-800">{formatAmount(service.unitAmount, service.currency)}</td><td className="px-5 py-4 text-slate-600">{service.chargeType === 'PER_PERSON' ? 'Kişi başı' : 'Rezervasyon başı'}</td><td className="px-5 py-4 text-slate-600">{service.maximumQuantity}</td><td className="px-5 py-4">{service.archivedAt ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Arşivde</span> : <button type="button" onClick={() => void toggleActive(service)} className={service.active ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600'}>{service.active ? 'Aktif' : 'Pasif'}</button>}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(service); setForm(toForm(service)); }} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Edit3 size={14} />Düzenle</button><button type="button" onClick={() => void remove(service)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-red-200 px-2 text-xs font-bold text-red-700 hover:bg-red-50">{service.archivedAt ? <Trash2 size={14} /> : <Archive size={14} />}{service.archivedAt ? 'Sil' : 'Arşivle'}</button></div></td></tr>)}</tbody></table></div></div>}
      {form && <ServiceForm form={form} editing={editing} saving={saving} onChange={updateForm} onClose={() => { setForm(null); setEditing(null); }} onSave={() => void save()} />}
    </div>
  );
}

function ServiceForm({ form, editing, saving, onChange, onClose, onSave }: { form: FormValues; editing: OptionalService | null; saving: boolean; onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="optional-service-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 id="optional-service-title" className="text-lg font-bold text-slate-900">{editing ? 'Ek hizmeti düzenle' : 'Yeni ek hizmet'}</h2><p className="mt-1 text-sm text-slate-600">Tutarlar kuruş/cent olarak kaydedilir; ekranda para biriminin ana birimiyle girin.</p></div><button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Hizmet adı"><input value={form.name} onChange={(e) => onChange('name', e.target.value)} /></Field><Field label="Sabit anahtar"><input value={form.key} onChange={(e) => onChange('key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="CHILD_SEAT" /></Field><Field label="Fiyat"><input type="number" min="0" step="0.01" value={form.unitAmount / 100} onChange={(e) => onChange('unitAmount', Math.round(Number(e.target.value || 0) * 100))} /></Field><Field label="Para birimi"><select value={form.currency} onChange={(e) => onChange('currency', e.target.value as FormValues['currency'])}><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></Field><Field label="Ücretlendirme"><select value={form.chargeType} onChange={(e) => onChange('chargeType', e.target.value as FormValues['chargeType'])}><option value="PER_BOOKING">Rezervasyon başı</option><option value="PER_PERSON">Kişi başı</option></select></Field><Field label="Azami adet"><input type="number" min="1" max="100" value={form.maximumQuantity} onChange={(e) => onChange('maximumQuantity', Number(e.target.value))} /></Field><Field label="Sıralama"><input type="number" min="0" value={form.displayOrder} onChange={(e) => onChange('displayOrder', Number(e.target.value))} /></Field><div className="space-y-3 pt-2"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => onChange('active', e.target.checked)} />Aktif</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.includedInTransfer} onChange={(e) => onChange('includedInTransfer', e.target.checked)} />Transfer fiyatına dahil</label></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Vazgeç</button><button type="button" disabled={saving} onClick={onSave} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{editing ? 'Kaydet' : 'Hizmet oluştur'}</button></div></div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}<span className="mt-1 block [&_input]:min-h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_select]:min-h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:px-3">{children}</span></label>; }