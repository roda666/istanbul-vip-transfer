'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Car, ChevronDown, Clock, MapPin, Plus, RefreshCw, Save, User, X } from 'lucide-react';
import { AdminActionButton } from '../../_components/AdminActionButton';

type Item = { id: string; plannedPickupAt: string; pickupLocationSummary: string; dropoffLocationSummary: string; customerSummary: string; status: string; driver?: { name: string } | null; vehicle?: { name: string } | null };
type Driver = { id: string; name: string; isActive: boolean };
type Vehicle = { id: string; name: string; isActive: boolean };

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planlandı',
  ASSIGNED: 'Atandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-700 border-slate-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const colors = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-bold ${colors}`}>
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative [&_input]:min-h-[44px] [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-200 [&_input]:bg-slate-50 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:font-medium [&_input]:text-slate-900 [&_input]:outline-none [&_input]:transition-all focus-within:[&_input]:border-blue-500 focus-within:[&_input]:bg-white focus-within:[&_input]:ring-4 focus-within:[&_input]:ring-blue-500/10 [&_select]:min-h-[44px] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-200 [&_select]:bg-slate-50 [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:font-medium [&_select]:text-slate-900 [&_select]:outline-none [&_select]:transition-all focus-within:[&_select]:border-blue-500 focus-within:[&_select]:bg-white focus-within:[&_select]:ring-4 focus-within:[&_select]:ring-blue-500/10">
        {children}
      </div>
    </label>
  );
}

export default function TransfersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ plannedPickupAt: '', pickupLocationSummary: '', dropoffLocationSummary: '', routeSummary: '', customerSummary: '', driverId: '', vehicleId: '' });
  const [saving, setSaving] = useState(false);

  const status = searchParams.get('status') ?? '';
  const assigned = searchParams.get('assigned') ?? '';
  const date = searchParams.get('date') ?? '';

  const load = useCallback(async () => {
    setError('');
    setItems(null);
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (assigned) p.set('assigned', assigned);
      if (date) p.set('date', date);
      const r = await fetch(`/admin/api/transfers${p.toString() ? `?${p}` : ''}`);
      if (!r.ok) throw new Error();
      setItems((await r.json()).items);
    } catch {
      setError('Transferler yüklenemedi.');
    }
  }, [assigned, date, status]);

  useEffect(() => {
    void load();
    void Promise.all([
      fetch('/admin/api/drivers').then(r => r.json()),
      fetch('/admin/api/vehicles?limit=100').then(r => r.json())
    ]).then(([d, v]) => {
      setDrivers((d.items ?? []).filter((x: Driver) => x.isActive));
      setVehicles((v.items ?? []).filter((x: Vehicle) => x.isActive));
    }).catch(() => {});
  }, [load]);

  function updateFilter(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.replace(`${pathname}${p.toString() ? `?${p}` : ''}`, { scroll: false });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/admin/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plannedPickupAt: new Date(form.plannedPickupAt).toISOString(), driverId: form.driverId || null, vehicleId: form.vehicleId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setShowCreate(false);
      setForm({ plannedPickupAt: '', pickupLocationSummary: '', dropoffLocationSummary: '', routeSummary: '', customerSummary: '', driverId: '', vehicleId: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  async function assign(id: string, driverId: string, vehicleId: string) {
    const r = await fetch(`/admin/api/transfers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: driverId || null, vehicleId: vehicleId || null })
    });
    if (!r.ok) setError((await r.json()).error ?? 'Atama yapılamadı.');
    else await load();
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 w-full sm:w-auto ml-auto">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 sm:flex-none"
          >
            <RefreshCw size={18} className={!items ? "animate-spin" : ""} />
            Yenile
          </button>
          {!showCreate && (
            <AdminActionButton
              label="Yeni Transfer"
              icon={Plus}
              variant="new"
              onClick={() => setShowCreate(true)}
              className="flex-1 sm:flex-none"
            />
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm animate-in fade-in">
          <span className="flex gap-2.5">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </span>
          <button
            onClick={() => void load()}
            aria-label="Yeniden dene"
            className="min-h-[44px] whitespace-nowrap rounded-lg px-4 font-bold text-red-900 transition-colors hover:bg-red-100 -m-2 ml-2"
          >
            Yeniden dene
          </button>
        </div>
      )}

      {showCreate && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Yeni Transfer Planla</h2>
              <p className="mt-0.5 text-sm text-slate-500">Operasyon için yeni bir transfer kaydı oluşturun.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Formu kapat"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={create} aria-label="Yeni transfer oluşturma formu" className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
                  <Clock size={16} className="text-blue-600" />
                  Zaman ve Rota
                </h3>
                <Field label="Alış Zamanı">
                  <input required type="datetime-local" value={form.plannedPickupAt} onChange={e => setForm({ ...form, plannedPickupAt: e.target.value })} />
                </Field>
                <Field label="Alış Konumu">
                  <input required placeholder="Örn: IST Havalimanı" value={form.pickupLocationSummary} onChange={e => setForm({ ...form, pickupLocationSummary: e.target.value })} />
                </Field>
                <Field label="Varış Konumu">
                  <input required placeholder="Örn: Beşiktaş Merkez" value={form.dropoffLocationSummary} onChange={e => setForm({ ...form, dropoffLocationSummary: e.target.value })} />
                </Field>
                <Field label="Rota Özeti">
                  <input required placeholder="Örn: IST Havalimanı → Beşiktaş" value={form.routeSummary} onChange={e => setForm({ ...form, routeSummary: e.target.value })} />
                </Field>
              </div>

              <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
                  <User size={16} className="text-amber-600" />
                  Müşteri ve Atama
                </h3>
                <Field label="Müşteri Özeti">
                  <input required placeholder="Örn: John Doe (+90 555...)" value={form.customerSummary} onChange={e => setForm({ ...form, customerSummary: e.target.value })} />
                </Field>
                <Field label="Sürücü (İsteğe Bağlı)">
                  <div className="relative">
                    <select className="appearance-none pr-10" value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })}>
                      <option value="">Atanmadı</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
                <Field label="Araç (İsteğe Bağlı)">
                  <div className="relative">
                    <select className="appearance-none pr-10" value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
                      <option value="">Atanmadı</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 pt-2 sm:flex-row border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                İptal
              </button>
              <AdminActionButton
                type="submit"
                icon={Save}
                variant="save"
                loading={saving}
                disabled={saving}
                label={saving ? 'Oluşturuluyor…' : 'Transfer Oluştur'}
                className="!border-slate-800 !bg-slate-900 !text-amber-400 hover:!bg-slate-800 px-6"
              />
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {/* Filters */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <select
              aria-label="Durum filtresi"
              value={status}
              onChange={e => updateFilter('status', e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
            >
              <option value="">Tüm durumlar</option>
              <option value="PLANNED">Planlandı</option>
              <option value="ASSIGNED">Atandı</option>
              <option value="IN_PROGRESS">Devam ediyor</option>
              <option value="COMPLETED">Tamamlandı</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <select
              aria-label="Atama filtresi"
              value={assigned}
              onChange={e => updateFilter('assigned', e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
            >
              <option value="">Tüm atamalar</option>
              <option value="false">Atama bekleyen</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <input
            aria-label="Gün filtresi"
            type="date"
            value={date}
            onChange={e => updateFilter('date', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
          />
        </div>

        {/* Content */}
        {!items ? (
          <div aria-busy="true" className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
              <Car size={28} className="text-slate-400" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Transfer Bulunamadı</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Seçilen filtrelere uygun transfer kaydı mevcut değil.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-bold whitespace-nowrap">Tarih / Saat</th>
                      <th className="px-5 py-3 font-bold min-w-[240px]">Güzergah</th>
                      <th className="px-5 py-3 font-bold min-w-[160px]">Müşteri</th>
                      <th className="px-5 py-3 font-bold min-w-[160px]">Araç Atama</th>
                      <th className="px-5 py-3 font-bold min-w-[160px]">Sürücü Atama</th>
                      <th className="px-5 py-3 font-bold text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => {
                      const dt = new Date(item.plannedPickupAt);
                      const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short' }).format(dt);
                      const timeStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', timeStyle: 'short' }).format(dt);

                      return (
                        <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                          <td className="px-5 py-4 align-top">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{dateStr}</span>
                              <span className="mt-0.5 text-xs font-semibold text-slate-500">{timeStr}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start gap-2">
                                <MapPin size={16} className="mt-0.5 shrink-0 text-blue-500" />
                                <span className="font-bold text-slate-700 leading-tight">{item.pickupLocationSummary}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                                <span className="font-bold text-slate-700 leading-tight">{item.dropoffLocationSummary}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="font-bold text-slate-900">{item.customerSummary}</span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="relative">
                              <select
                                aria-label={`${item.customerSummary} araç`}
                                value={item.vehicle ? vehicles.find(v => v.name === item.vehicle?.name)?.id ?? '' : ''}
                                onChange={e => assign(item.id, item.driver ? drivers.find(d => d.name === item.driver?.name)?.id ?? '' : '', e.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none transition-all hover:bg-slate-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
                              >
                                <option value="">Atanmadı</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="relative">
                              <select
                                aria-label={`${item.customerSummary} sürücü`}
                                value={item.driver ? drivers.find(d => d.name === item.driver?.name)?.id ?? '' : ''}
                                onChange={e => assign(item.id, e.target.value, item.vehicle ? vehicles.find(v => v.name === item.vehicle?.name)?.id ?? '' : '')}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none transition-all hover:bg-slate-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
                              >
                                <option value="">Atanmadı</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet Cards */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {items.map(item => {
                const dt = new Date(item.plannedPickupAt);
                const dateStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short' }).format(dt);
                const timeStr = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', timeStyle: 'short' }).format(dt);

                return (
                  <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-slate-900">{dateStr}</span>
                        <span className="text-sm font-semibold text-slate-500">{timeStr}</span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-blue-500" />
                        <div>
                          <div className="mb-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">Alış</div>
                          <div className="text-sm font-bold text-slate-800 leading-tight">{item.pickupLocationSummary}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <div>
                          <div className="mb-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">Varış</div>
                          <div className="text-sm font-bold text-slate-800 leading-tight">{item.dropoffLocationSummary}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Müşteri</div>
                      <div className="text-sm font-bold text-slate-900">{item.customerSummary}</div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Araç Ataması</label>
                        <div className="relative">
                          <select
                            aria-label={`${item.customerSummary} araç`}
                            value={item.vehicle ? vehicles.find(v => v.name === item.vehicle?.name)?.id ?? '' : ''}
                            onChange={e => assign(item.id, item.driver ? drivers.find(d => d.name === item.driver?.name)?.id ?? '' : '', e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
                          >
                            <option value="">Atanmadı</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Sürücü Ataması</label>
                        <div className="relative">
                          <select
                            aria-label={`${item.customerSummary} sürücü`}
                            value={item.driver ? drivers.find(d => d.name === item.driver?.name)?.id ?? '' : ''}
                            onChange={e => assign(item.id, e.target.value, item.vehicle ? vehicles.find(v => v.name === item.vehicle?.name)?.id ?? '' : '')}
                            className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[44px]"
                          >
                            <option value="">Atanmadı</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
