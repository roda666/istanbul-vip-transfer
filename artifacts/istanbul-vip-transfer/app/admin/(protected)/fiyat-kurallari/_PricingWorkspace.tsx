'use client';

import { useState } from 'react';
import { Calculator, MapPinned } from 'lucide-react';
import FormulaPricingClient from './_FormulaPricingClient';
import PriceRulesClient from './_PriceRulesClient';

type Tab = 'formula' | 'legacy';

export default function PricingWorkspace() {
  const [tab, setTab] = useState<Tab>('formula');

  return (
    <section>
      <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('formula')}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'formula' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Calculator size={16} />
          Formül ve Kur Motoru
        </button>
        <button
          type="button"
          onClick={() => setTab('legacy')}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'legacy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <MapPinned size={16} />
          Elle Sabitlenmiş Fiyatlar
        </button>
      </div>

      {tab === 'formula' ? <FormulaPricingClient /> : (
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