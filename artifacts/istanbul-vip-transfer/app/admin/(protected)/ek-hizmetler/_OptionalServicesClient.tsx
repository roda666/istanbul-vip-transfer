'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, PackagePlus, RefreshCw } from 'lucide-react';

type OptionalService = {
  id: string;
  key: string;
  name: string;
  currency: string;
  unitAmount: number;
  chargeType: string;
  active: boolean;
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(amount / 100);
}

export default function OptionalServicesClient() {
  const [services, setServices] = useState<OptionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/admin/api/ek-hizmetler', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as { services?: OptionalService[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Ek hizmetler alınamadı.');
      }
      setServices(payload?.services ?? []);
    } catch (caught) {
      setServices([]);
      setError(caught instanceof Error ? caught.message : 'Ek hizmetler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Loader2 size={20} className="animate-spin text-blue-600" />
          Ek hizmetler yükleniyor…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle size={21} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <p className="font-bold text-red-900">Ek hizmetler yüklenemedi</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadServices()}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
            >
              <RefreshCw size={15} />
              Tekrar dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <PackagePlus size={28} className="mx-auto text-slate-400" />
        <p className="mt-3 font-bold text-slate-900">Henüz ek hizmet tanımlanmadı</p>
        <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">
          Bu alan, transfer teklifiyle sunulabilecek ücretli ek hizmetleri gösterecek.
          Yönetim işlemleri yakında bu ekranda kullanılabilir olacak.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-bold">Hizmet</th>
              <th className="px-5 py-3 font-bold">Ücret</th>
              <th className="px-5 py-3 font-bold">Ücretlendirme</th>
              <th className="px-5 py-3 font-bold">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((service) => (
              <tr key={service.id}>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{service.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{service.key}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-slate-800">
                  {formatAmount(service.unitAmount, service.currency)}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {service.chargeType === 'PER_PERSON' ? 'Kişi başı' : 'Rezervasyon başı'}
                </td>
                <td className="px-5 py-4">
                  <span className={service.active
                    ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700'
                    : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600'}
                  >
                    {service.active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}