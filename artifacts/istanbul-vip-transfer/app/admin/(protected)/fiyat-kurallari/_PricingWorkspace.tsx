'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calculator, MapPinned, PackagePlus, Settings2, TableProperties } from 'lucide-react';
import FormulaPricingClient from './_FormulaPricingClient';
import PriceRulesClient from './_PriceRulesClient';
import OptionalServicesClient from '../ek-hizmetler/_OptionalServicesClient';

type Tab = 'engine' | 'policy' | 'formulas' | 'legacy' | 'ek-hizmetler';

export default function PricingWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'ek-hizmetler' ? 'ek-hizmetler' : 'engine');
  const selectTab = (next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'ek-hizmetler') params.set('tab', next);
    else params.delete('tab');
    router.replace(`/admin/fiyat-kurallari${params.size ? `?${params}` : ''}`);
  };

  return (
    <section>
      <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
           onClick={() => selectTab('engine')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'engine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Calculator size={16} />
          Formül ve Kur Motoru
        </button>
        <button
          type="button"
           onClick={() => selectTab('policy')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'policy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Settings2 size={16} />
          Kur ve Maliyet Politikası
        </button>
        <button
          type="button"
           onClick={() => selectTab('formulas')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'formulas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <TableProperties size={16} />
          Hesaplama Formülleri
        </button>
        <button
          type="button"
           onClick={() => selectTab('legacy')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'legacy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <MapPinned size={16} />
          Elle Sabitlenmiş Fiyatlar
        </button>
        <button type="button" onClick={() => selectTab('ek-hizmetler')} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'ek-hizmetler' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
          <PackagePlus size={16} /> Ek Hizmetler
        </button>
      </div>

      {tab === 'ek-hizmetler' ? <OptionalServicesClient /> : tab !== 'legacy' ? <FormulaPricingClient view={tab} /> : (
        <div>
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>İkincil alan:</strong> Bu kayıtlar yalnızca belirli rota ve araçlar için elle sabitlenmiş eski fiyatlardır.
            Yeni fiyat mantığını araç formülleri üzerinden yönetin; değişiklikler aktif/pasif durumu ile hemen etkili olur.
          </div>
          <PriceRulesClient />
        </div>
      )}
    </section>
  );
}