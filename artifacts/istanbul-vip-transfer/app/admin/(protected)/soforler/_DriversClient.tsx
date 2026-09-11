'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Check, Edit3, Loader2, Plus, RefreshCw, Trash2, X, Users } from 'lucide-react';

type Driver = { id: string; name: string; phone: string | null; notes: string | null; isActive: boolean; displayOrder: number };
type FormValues = Omit<Driver, 'id' | 'displayOrder'>;

const blankForm: FormValues = { name: '', phone: '', notes: '', isActive: true };

export default function DriversClient() {
  const [items, setItems] = useState<Driver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Driver | 'new' | null>(null);
  const [form, setForm] = useState<FormValues>(blankForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/admin/api/drivers');
      const isJson = r.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await r.json().catch(() => null) : null;
      if (!r.ok) throw new Error(data?.error ?? 'Sürücüler yüklenemedi.');
      setItems(data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sürücüler yüklenemedi.');
      setItems(prev => prev || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const isNew = editing === 'new';
      const endpoint = isNew ? '/admin/api/drivers' : `/admin/api/drivers/${(editing as Driver).id}`;

      const response = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;
      if (!response.ok) throw new Error(payload?.error ?? 'Sürücü kaydedilemedi.');

      setForm(blankForm); setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sürücü kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (driver: Driver) => {
    if (!window.confirm(`"${driver.name}" sürücüsü silinsin mi?`)) return;
    setActionId(driver.id);
    try {
      const response = await fetch(`/admin/api/drivers/${driver.id}`, { method: 'DELETE' });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;
      if (!response.ok) throw new Error(payload?.error ?? 'Sürücü silinemedi.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sürücü silinemedi.');
    } finally {
      setActionId(null);
    }
  };

  const toggleActive = async (driver: Driver) => {
    setActionId(driver.id);
    try {
      const response = await fetch(`/admin/api/drivers/${driver.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !driver.isActive }),
      });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;
      if (!response.ok) throw new Error(payload?.error ?? 'Durum güncellenemedi.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Durum güncellenemedi.');
    } finally {
      setActionId(null);
    }
  };

  const reorder = async (driver: Driver, direction: 'up' | 'down') => {
    setActionId(driver.id);
    try {
      const response = await fetch(`/admin/api/drivers/${driver.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reorder', direction }),
      });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;
      if (!response.ok) throw new Error(payload?.error ?? 'Sıralama güncellenemedi.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sıralama güncellenemedi.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 w-full sm:w-auto ml-auto">
          <button type="button" onClick={() => void load()} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 flex-1 sm:flex-none justify-center">
            <RefreshCw size={18} />Yenile
          </button>
          <button type="button" onClick={() => { setEditing('new'); setForm(blankForm); }} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 flex-1 sm:flex-none justify-center">
            <Plus size={18} />Yeni sürücü
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="flex gap-2"><AlertCircle size={18} className="shrink-0" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Hata mesajını kapat" className="min-h-[44px] min-w-[44px] flex items-center justify-center -m-2"><X size={18} /></button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600 flex items-center">
          <Loader2 size={20} className="animate-spin text-blue-600" />
          <span className="ml-3 text-sm font-semibold">Sürücüler yükleniyor…</span>
        </div>
      ) : items?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Users size={32} className="mx-auto text-slate-400" />
          <p className="mt-4 font-bold text-slate-900 text-base">Henüz sürücü kaydı yok</p>
          <p className="mt-1 text-sm text-slate-500">Sistemde kayıtlı bir sürücü bulunamadı.</p>
          <button type="button" onClick={() => { setEditing('new'); setForm(blankForm); }} className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700">İlk sürücüyü ekle</button>
        </div>
      ) : (
        <>
          <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Sürücü</th>
                    <th className="px-5 py-3 font-semibold">İletişim</th>
                    <th className="px-5 py-3 font-semibold">Notlar</th>
                    <th className="px-5 py-3 font-semibold">Durum</th>
                    <th className="px-5 py-3 font-semibold text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items?.map((driver, index) => (
                    <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 text-base">{driver.name}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">
                        {driver.phone || <span className="text-slate-400 font-normal italic">Belirtilmemiş</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-xs max-w-[200px] truncate" title={driver.notes || ''}>
                        {driver.notes || <span className="text-slate-400 font-normal italic">Yok</span>}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleActive(driver)}
                          disabled={actionId === driver.id}
                          className={driver.isActive
                            ? 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-200 transition-colors hover:bg-emerald-100 disabled:opacity-50'
                            : 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 transition-colors hover:bg-slate-200 disabled:opacity-50'
                          }
                        >
                          {actionId === driver.id ? <Loader2 size={16} className="animate-spin" /> : (driver.isActive ? 'Aktif' : 'Pasif')}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" disabled={index === 0 || actionId !== null} onClick={() => void reorder(driver, 'up')} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors" aria-label="Yukarı taşı"><ArrowUp size={18} /></button>
                          <button type="button" disabled={index === (items?.length ?? 0) - 1 || actionId !== null} onClick={() => void reorder(driver, 'down')} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors" aria-label="Aşağı taşı"><ArrowDown size={18} /></button>
                          <button type="button" onClick={() => { setEditing(driver); setForm({ name: driver.name, phone: driver.phone ?? '', notes: driver.notes ?? '', isActive: driver.isActive }); }} className="inline-flex min-h-[44px] min-w-[44px] sm:min-w-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                            <Edit3 size={18} /><span className="hidden sm:inline">Düzenle</span>
                          </button>
                          <button type="button" onClick={() => void remove(driver)} disabled={actionId === driver.id} className="inline-flex min-h-[44px] min-w-[44px] sm:min-w-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                            {actionId === driver.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}<span className="hidden sm:inline">Sil</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {items?.map((driver, index) => (
              <div key={driver.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{driver.name}</h3>
                    <p className="mt-1 font-medium text-slate-700">
                      {driver.phone || <span className="font-normal italic text-slate-400">Belirtilmemiş</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleActive(driver)}
                    disabled={actionId === driver.id}
                    className={driver.isActive
                      ? 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50'
                      : 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50'
                    }
                  >
                    {actionId === driver.id ? <Loader2 size={16} className="animate-spin" /> : (driver.isActive ? 'Aktif' : 'Pasif')}
                  </button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="mb-1 block font-semibold text-slate-700">Notlar:</span>
                  {driver.notes ? (
                    <p className="whitespace-pre-wrap">{driver.notes}</p>
                  ) : (
                    <span className="italic text-slate-400">Not yok</span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button type="button" disabled={index === 0 || actionId !== null} onClick={() => void reorder(driver, 'up')} className="inline-flex flex-1 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40" aria-label="Yukarı taşı">
                    <ArrowUp size={18} />
                  </button>
                  <button type="button" disabled={index === (items?.length ?? 0) - 1 || actionId !== null} onClick={() => void reorder(driver, 'down')} className="inline-flex flex-1 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40" aria-label="Aşağı taşı">
                    <ArrowDown size={18} />
                  </button>
                  <button type="button" onClick={() => { setEditing(driver); setForm({ name: driver.name, phone: driver.phone ?? '', notes: driver.notes ?? '', isActive: driver.isActive }); }} className="inline-flex flex-1 min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100" aria-label="Düzenle">
                    <Edit3 size={18} /><span>Düzenle</span>
                  </button>
                  <button type="button" onClick={() => void remove(driver)} disabled={actionId === driver.id} className="inline-flex flex-1 min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50" aria-label="Sil">
                    {actionId === driver.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}<span>Sil</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <DriverForm
          form={form}
          editing={editing}
          saving={saving}
          onChange={updateForm}
          onClose={() => { setForm(blankForm); setEditing(null); }}
          onSave={() => void save()}
        />
      )}
    </div>
  );
}

function DriverForm({ form, editing, saving, onChange, onClose, onSave }: { form: FormValues; editing: Driver | 'new'; saving: boolean; onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void; onClose: () => void; onSave: () => void }) {
  const canSave = form.name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="driver-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 id="driver-title" className="text-xl font-bold text-slate-900">{editing === 'new' ? 'Yeni Sürücü Ekle' : 'Sürücüyü Düzenle'}</h2>
            <p className="mt-1.5 text-sm text-slate-500">Operasyon sürücülerini ve bilgilerini yönetin.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors -mr-2 -mt-2" aria-label="Kapat"><X size={24} /></button>
        </div>

        <div className="mt-6 space-y-5">
          <Field label="Ad Soyad">
            <input required value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Örn: Ahmet Yılmaz" />
          </Field>
          <Field label="Telefon Numarası">
            <input value={form.phone ?? ''} onChange={(e) => onChange('phone', e.target.value)} placeholder="Örn: +90 555 123 4567" type="tel" />
          </Field>
          <Field label="Notlar">
            <textarea value={form.notes ?? ''} onChange={(e) => onChange('notes', e.target.value)} placeholder="Sürücü ile ilgili ek bilgiler..." rows={3} className="resize-y" />
          </Field>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 transition-colors hover:bg-slate-100">
            <input type="checkbox" checked={form.isActive} onChange={(e) => onChange('isActive', e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-semibold text-slate-900">Aktif sürücü</span>
          </label>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-5 border-t border-slate-100">
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">İptal</button>
          <button type="button" disabled={saving || !canSave} onClick={onSave} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {editing === 'new' ? 'Sürücüyü Ekle' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <span className="mt-1.5 block [&_input]:min-h-[48px] [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-4 [&_input]:text-sm [&_input]:transition-all [&_input:focus]:border-blue-500 [&_input:focus]:ring-4 [&_input:focus]:ring-blue-500/10 [&_textarea]:min-h-[48px] [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-white [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:transition-all [&_textarea:focus]:border-blue-500 [&_textarea:focus]:ring-4 [&_textarea:focus]:ring-blue-500/10">
        {children}
      </span>
    </label>
  );
}
