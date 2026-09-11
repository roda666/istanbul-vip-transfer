'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Archive, ArrowDown, ArrowUp, Check, Edit3, Loader2, PackagePlus, Plus, RefreshCw, Trash2, X } from 'lucide-react';

type OptionalService = {
  id: string; key: string; name: string; shortDescription: string | null; currency: 'TRY' | 'EUR' | 'USD'; unitAmount: number;
  chargeType: 'PER_BOOKING' | 'PER_PERSON'; maximumQuantity: number; includedInTransfer: boolean;
  serviceTypeScope: string[]; automaticServiceTypes: string[]; customerVisible: boolean;
  translationStatus?: Record<string, string>;
  active: boolean; displayOrder: number; archivedAt: string | null;
};
type FormValues = Omit<OptionalService, 'id' | 'archivedAt'>;
type ServiceType = { key: string; label: string; enabled: boolean };

const blankForm: FormValues = {
  key: '', name: '', shortDescription: '', currency: 'TRY', unitAmount: 0, chargeType: 'PER_BOOKING',
  maximumQuantity: 1, includedInTransfer: false, serviceTypeScope: [], automaticServiceTypes: [], customerVisible: true, active: true, displayOrder: 0,
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
export function toggleServiceType(values: string[], key: string, checked: boolean) {
  return checked ? (values.includes(key) ? values : [...values, key]) : values.filter((value) => value !== key);
}
export function serviceTypeIsSelected(values: string[], key: string) { return values.includes(key); }

export default function OptionalServicesClient() {
  const [services, setServices] = useState<OptionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [editing, setEditing] = useState<OptionalService | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);

  const loadServices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [response, typesResponse] = await Promise.all([
        fetch(`/admin/api/ek-hizmetler${showArchived ? '?archived=true' : ''}`, { cache: 'no-store' }),
        fetch('/admin/api/service-types', { cache: 'no-store' }),
      ]);
      const payload = await response.json().catch(() => null) as { services?: OptionalService[]; error?: string } | null;
      const typesPayload = await typesResponse.json().catch(() => null) as { items?: ServiceType[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Ek hizmetler alınamadı.');
      if (!typesResponse.ok) throw new Error(typesPayload?.error ?? 'Hizmet türleri alınamadı.');
      setServices(payload?.services ?? []);
      setServiceTypes((typesPayload?.items ?? []).filter((item) => item.enabled));
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
      const payload = await response.json().catch(() => null) as { error?: string; translationJob?: { job?: { id: string }; tasks?: Array<{ id: string }> } | null } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Hizmet kaydedilemedi.');
      setForm(null); setEditing(null);
      const job = payload?.translationJob;
      if (job?.job?.id && job.tasks?.length) {
        // Keep provider work bounded: two tasks at a time, with the server-side
        // claim preventing duplicate jobs/tabs from issuing duplicate calls.
        for (let index = 0; index < job.tasks.length; index += 2) {
          await Promise.all(job.tasks.slice(index, index + 2).map((task) =>
            fetch(`/admin/api/translations/jobs/${job.job!.id}/tasks/${task.id}/run`, { method: 'POST' }),
          ));
        }
      }
      await loadServices();
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
  const reorder = async (service: OptionalService, direction: 'up' | 'down') => {
    try {
      const response = await fetch(`/admin/api/ek-hizmetler/${service.id}/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Sıralama güncellenemedi.');
      await loadServices();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sıralama güncellenemedi.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Arşivdekileri göster
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadServices()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} />Yenile</button>
          <button type="button" onClick={() => { setEditing(null); setForm(blankForm); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"><Plus size={17} />Yeni hizmet</button>
        </div>
      </div>
      {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span className="flex gap-2"><AlertCircle size={18} />{error}</span><button onClick={() => setError(null)} aria-label="Hata mesajını kapat"><X size={17} /></button></div>}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600"><Loader2 size={20} className="inline animate-spin text-blue-600" /> <span className="ml-2 text-sm font-semibold">Ek hizmetler yükleniyor…</span></div>
        : services.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><PackagePlus size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-bold text-slate-900">{showArchived ? 'Arşivlenmiş hizmet yok' : 'Henüz ek hizmet tanımlanmadı'}</p><button type="button" onClick={() => { setEditing(null); setForm(blankForm); }} className="mt-4 text-sm font-bold text-blue-700 hover:underline">İlk hizmeti ekle</button></div>
        : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Hizmet</th><th className="px-5 py-3">Ücret</th><th className="px-5 py-3">Kapsam / görünürlük</th><th className="px-5 py-3">Durum / çeviri</th><th className="px-5 py-3 text-right">İşlemler</th></tr></thead><tbody className="divide-y divide-slate-100">{services.map((service) => { const visibleServices = services.filter((item) => !item.archivedAt); const index = visibleServices.findIndex((item) => item.id === service.id); return <tr key={service.id}><td className="px-5 py-4"><p className="font-semibold text-slate-900">{service.name}</p><p className="text-xs text-slate-500">{service.shortDescription}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{service.key}{service.includedInTransfer ? ' · Dahil' : ' · Ayrı ücretli'} · {service.chargeType === 'PER_PERSON' ? 'Adet başı' : 'Rezervasyon başı'} · max {service.maximumQuantity}</p></td><td className="px-5 py-4 font-semibold text-slate-800">{formatAmount(service.unitAmount, service.currency)}</td><td className="px-5 py-4 text-xs text-slate-600">{service.serviceTypeScope.length ? service.serviceTypeScope.map((key) => serviceTypes.find((type) => type.key === key)?.label ?? key).join(', ') : 'Kapsam yok'}<br />{service.customerVisible ? 'Müşteriye görünür' : 'Gizli'}</td><td className="px-5 py-4">{service.archivedAt ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Arşivde</span> : <button type="button" onClick={() => void toggleActive(service)} className={service.active ? 'min-h-11 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700' : 'min-h-11 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'}>{service.active ? 'Aktif' : 'Pasif'}</button>}<div className="mt-1 flex flex-wrap gap-1">{Object.entries(service.translationStatus ?? {}).length ? Object.entries(service.translationStatus ?? {}).map(([locale, status]) => <span key={locale} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{locale}: {status}</span>) : <span className="text-xs text-slate-500">Çeviri kuyruğu yok</span>}</div></td><td className="px-5 py-4"><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={service.archivedAt !== null || index === 0} onClick={() => void reorder(service, 'up')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700 disabled:opacity-40" aria-label="Yukarı taşı"><ArrowUp size={16} /></button><button type="button" disabled={service.archivedAt !== null || index === -1 || index === visibleServices.length - 1} onClick={() => void reorder(service, 'down')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700 disabled:opacity-40" aria-label="Aşağı taşı"><ArrowDown size={16} /></button><button type="button" onClick={() => { setEditing(service); setForm(toForm(service)); }} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><Edit3 size={14} />Düzenle</button><button type="button" onClick={() => void remove(service)} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50">{service.archivedAt ? <Trash2 size={14} /> : <Archive size={14} />}{service.archivedAt ? 'Sil' : 'Arşivle'}</button></div></td></tr>; })}</tbody></table></div></div>}
       {form && <ServiceForm form={form} editing={editing} serviceTypes={serviceTypes} saving={saving} onChange={updateForm} onClose={() => { setForm(null); setEditing(null); }} onSave={() => void save()} />}
    </div>
  );
}

function ServiceForm({ form, editing, serviceTypes, saving, onChange, onClose, onSave }: { form: FormValues; editing: OptionalService | null; serviceTypes: ServiceType[]; saving: boolean; onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void; onClose: () => void; onSave: () => void }) {
  const canSave = form.name.trim().length > 0 && form.key.length >= 2 && form.unitAmount > 0
    && form.maximumQuantity >= 1 && form.maximumQuantity <= 100;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="optional-service-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="optional-service-title" className="text-lg font-bold text-slate-900">{editing ? 'Ek hizmeti düzenle' : 'Yeni ek hizmet'}</h2><p className="mt-1 text-sm text-slate-600">Tutarlar kuruş/cent olarak kaydedilir. Adetli hizmetlerde 1–azami adet seçilebilir.</p></div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded p-2 text-slate-500 hover:bg-slate-100" aria-label="Kapat"><X size={20} /></button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Türkçe hizmet adı"><input required value={form.name} onChange={(e) => onChange('name', e.target.value)} /></Field>
          <Field label="Türkçe kısa açıklama"><input value={form.shortDescription ?? ''} onChange={(e) => onChange('shortDescription', e.target.value)} /></Field>
          <Field label="Sabit anahtar"><input required disabled={Boolean(editing)} value={form.key} onChange={(e) => onChange('key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="CHILD_SEAT" /></Field>
           <Field label="Birim ücret"><input required type="number" min="0.01" step="0.01" value={form.unitAmount / 100} onChange={(e) => onChange('unitAmount', Math.round(Number(e.target.value || 0) * 100))} /></Field>
          <Field label="Para birimi"><select value={form.currency} onChange={(e) => onChange('currency', e.target.value as FormValues['currency'])}><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></Field>
          <Field label="Ücretlendirme"><select value={form.chargeType} onChange={(e) => onChange('chargeType', e.target.value as FormValues['chargeType'])}><option value="PER_BOOKING">Rezervasyon başı (tek seçim)</option><option value="PER_PERSON">Adet başı (1–azami adet)</option></select></Field>
          <Field label={`Azami adet${form.chargeType === 'PER_BOOKING' ? ' (rezervasyon başında 1)' : ''}`}><input required disabled={form.chargeType === 'PER_BOOKING'} type="number" min="1" max="100" value={form.chargeType === 'PER_BOOKING' ? 1 : form.maximumQuantity} onChange={(e) => onChange('maximumQuantity', Number(e.target.value))} /></Field>
           <fieldset className="space-y-2 md:col-span-2"><legend className="text-sm font-semibold text-slate-700">Hizmet türü kapsamı</legend><div className="grid gap-2 sm:grid-cols-2">{serviceTypes.map((type) => { const checked = serviceTypeIsSelected(form.serviceTypeScope, type.key); return <label key={type.key} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm font-medium transition-colors ${checked ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}><input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange('serviceTypeScope', toggleServiceType(form.serviceTypeScope, type.key, event.target.checked))} /><span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400 bg-white text-transparent'}`} aria-hidden="true"><Check size={14} /></span><span>{type.label}</span></label>; })}</div><p className="text-xs font-normal text-slate-500">Hiçbir tür seçilmezse hizmet müşteriye sunulan formda gizlenir; kapsam tüm türleri ifade etmez.</p></fieldset>
          <Field label="Sıralama"><input type="number" min="0" value={form.displayOrder} onChange={(e) => onChange('displayOrder', Number(e.target.value))} /></Field>
           <div className="space-y-3 pt-2 md:col-span-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => onChange('active', e.target.checked)} className="h-4 w-4" />Aktif</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.includedInTransfer} onChange={(e) => onChange('includedInTransfer', e.target.checked)} className="h-4 w-4" />Transfer fiyatına dahil (müşteriye listelenmez)</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.customerVisible} onChange={(e) => onChange('customerVisible', e.target.checked)} className="h-4 w-4" />Müşteriye görünür (yalnız ayrı ücretli hizmetlerde)</label>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Vazgeç</button><button type="button" disabled={saving || !canSave} onClick={onSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{editing ? 'Kaydet' : 'Hizmet oluştur'}</button></div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}<span className="mt-1 block [&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:px-3">{children}</span></label>; }