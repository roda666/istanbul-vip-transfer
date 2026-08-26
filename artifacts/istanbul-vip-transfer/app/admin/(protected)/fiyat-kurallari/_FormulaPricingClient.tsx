'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Calculator, RefreshCw, Plus, Check, X, Edit2, AlertCircle, TrendingUp, Loader2
} from 'lucide-react';

// --- Types ---

type Vehicle = { id: string; name: string; pricingClass: string; priceCalculationEligible: boolean; status: string };
type PricingRoute = {
  id: string;
  name: string;
  originLocationId: string | null;
  destinationLocationId: string | null;
  defaultVehicleId: string | null;
  distanceKm: number;
  distanceSource: 'LEGACY_UNVERIFIED' | 'COORDINATE_ESTIMATE' | 'ADMIN_VERIFIED';
  active: boolean;
};
type PricingLocation = { id: string; name: string; city: string };
type TollAlternative = {
  id: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  displayOrder: number;
  pointIds: string[];
  pointNames: string[];
  isPricedForSelectedVehicle: boolean;
  missingTariffPointNames: string[];
  isBannedForSelectedVehicle: boolean;
  bannedPointNames: string[];
};
type DistanceResult = {
  state: 'DEFINED_ROUTE' | 'ESTIMATED' | 'UNAVAILABLE';
  distanceKm?: number;
  source?: 'defined_route' | 'coordinate_estimate';
  roadDistanceMultiplier?: number;
  reason?: string;
};

type DistanceProfile = {
  id: string;
  vehicleId: string;
  active: boolean;
  mode: 'DISTANCE';
  distanceOpeningKurus: number;
  distanceFirstKmKurus: number;
  distanceThresholdKm: number;
  distanceSecondKmKurus: number;
  notes: string | null;
  updatedAt: string;
};

type HourlyProfile = {
  id: string;
  vehicleId: string;
  active: boolean;
  mode: 'HOURLY';
  hourlyRateKurus: number;
  minimumHours: number;
  includedKmMode: 'PER_HOUR' | 'PACKAGE';
  includedKm: number;
  excessKmKurus: number;
  excessHourKurus: number;
  notes: string | null;
  updatedAt: string;
};

type Profile = DistanceProfile | HourlyProfile;

type Settings = {
  policy: {
    vatRateBasisPoints: number;
    vatDisplayMode: 'EXCLUDED' | 'INCLUDED';
    eurRoundingKurus: number;
    usdRoundingCents: number;
    tryRoundingKurus: number;
  } | null;
  exchangeRates: {
    eurTryMode: 'LIVE' | 'MANUAL';
    eurUsdMode: 'LIVE' | 'MANUAL';
    manualEurTryMicros: number | null;
    manualEurUsdMicros: number | null;
    refreshMinutes: number;
    deviationBasisPoints: number;
  } | null;
  latestTcmb: {
    eurTryMicros: number;
    eurUsdMicros: number;
    fetchedAt: string;
  } | null;
};

type QuoteResult = {
  state: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_REQUEST';
  reason?: string;
  formulaKind?: string;
  lines?: { key: string; label: string; amountKurus: number; visibleToCustomer: boolean }[];
  netTryKurus?: number;
  vatTryKurus?: number;
  grossTryKurus?: number;
  rawEurCents?: number;
  quotedEurCents?: number;
  quotedUsdCents?: number;
  quotedTryKurus?: number;
  effectiveHours?: number;
  includedKmAllowance?: number;
  hasMissingTollData?: boolean;
  missingTollNames?: string[];
  hasStaleTollData?: boolean;
  staleTollNames?: string[];
};

type ExchangeRatePreview = {
  requiresConfirmation: true;
  candidate: {
    eurTryMicros: number;
    eurUsdMicros: number;
  };
  deviation?: {
    eurTry: number;
    eurUsd: number;
  };
};

type PricingSettingsDraft = {
  vatRate: number;
  vatMode: 'INCLUDED' | 'EXCLUDED';
  eurRounding: number;
  usdRounding: number;
  tryRounding: number;
  eurTryMode: 'LIVE' | 'MANUAL';
  eurUsdMode: 'LIVE' | 'MANUAL';
  manualEurTry: number;
  manualEurUsd: number;
  refreshMinutes: number;
  deviationLimit: number;
};

type ProfilePayload = {
  vehicleId: string;
  active: boolean;
  mode: 'DISTANCE' | 'HOURLY';
  notes: string | null;
  distanceOpeningKurus?: number;
  distanceFirstKmKurus?: number;
  distanceThresholdKm?: number;
  distanceSecondKmKurus?: number;
  hourlyRateKurus?: number;
  minimumHours?: number;
  includedKmMode?: 'PER_HOUR' | 'PACKAGE';
  includedKm?: number;
  excessKmKurus?: number;
  excessHourKurus?: number;
};

function isExchangeRatePreview(value: unknown): value is ExchangeRatePreview {
  if (!value || typeof value !== 'object') return false;
  const candidate = (value as { candidate?: unknown }).candidate;
  if (!candidate || typeof candidate !== 'object') return false;
  const preview = value as Partial<ExchangeRatePreview>;
  const rateCandidate = candidate as Partial<ExchangeRatePreview['candidate']>;
  return preview.requiresConfirmation === true
    && typeof rateCandidate.eurTryMicros === 'number'
    && typeof rateCandidate.eurUsdMicros === 'number';
}

// --- Helpers ---

const formatMoneyCents = (cents: number, currency: string) => 
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(cents / 100);

const formatMicros = (micros: number) => (micros / 1_000_000).toFixed(4);

const getReasonText = (reason?: string) => {
  switch(reason) {
    case 'MISSING_PROFILE': return 'Aktif fiyat formülü bulunamadı.';
    case 'INVALID_INPUT': return 'Geçersiz veya eksik parametreler.';
    case 'MISSING_RATE': return 'Döviz kuru eksik veya hatalı.';
    case 'MISSING_DISTANCE': return 'Kayıtlı konumlardan güvenilir mesafe çözümlenemedi.';
    case 'VEHICLE_NOT_ELIGIBLE': return 'Seçili araç fiyat hesaplamaya uygun değil.';
    default: return reason || 'Bilinmeyen Hata';
  }
};

// --- Reusable Components ---

function AmountInput({ value, onChange, label, symbol = '', decimals = 2, min = 0 }: { value: number, onChange: (val: number) => void, label: string, symbol?: string, decimals?: number, min?: number }) {
  const multiplier = Math.pow(10, decimals);
  const [str, setStr] = useState((value / multiplier).toFixed(decimals));

  useEffect(() => {
    setStr((value / multiplier).toFixed(decimals));
  }, [value, multiplier, decimals]);

  const handleBlur = () => {
    let parsed = parseFloat(str.replace(',', '.'));
    if (isNaN(parsed) || parsed < min) {
      parsed = min;
    }
    onChange(Math.round(parsed * multiplier));
    setStr(parsed.toFixed(decimals));
  };

  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={str} 
          onChange={e => setStr(e.target.value)}
          onBlur={handleBlur}
          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
        />
        {symbol && <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold pointer-events-none">{symbol}</span>}
      </div>
    </div>
  );
}

function DistanceExamples({ opening, first, threshold, second }: { opening: number, first: number, threshold: number, second: number }) {
  const calc = (km: number) => {
    const f = Math.min(km, threshold);
    const s = Math.max(0, km - threshold);
    return opening + f * first + s * (second > 0 ? second : first);
  };
  
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mt-4">
      <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase">
        <TrendingUp size={14} className="text-blue-500" /> Mesafe Projeksiyonu
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {[20, 50, 100, 200, 500].map(km => (
          <div key={km} className="bg-white px-3 py-2 rounded shadow-sm border border-slate-200 flex-1 min-w-[70px] text-center">
            <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">{km} KM</div>
            <div className="font-black text-slate-900 text-xs">{formatMoneyCents(calc(km), 'TRY')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Sub-Panels ---

function FastQuotePanel({
  vehicles,
  profiles,
  routes,
  locations,
}: {
  vehicles: Vehicle[];
  profiles: Profile[];
  routes: PricingRoute[];
  locations: PricingLocation[];
}) {
  const [quoteVehicleId, setQuoteVehicleId] = useState('');
  const [quoteMode, setQuoteMode] = useState<'DISTANCE' | 'HOURLY'>('DISTANCE');
  const [quoteRouteId, setQuoteRouteId] = useState('');
  const [originLocationId, setOriginLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [quoteHours, setQuoteHours] = useState(4);
  const [quoteTripType, setQuoteTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');
  const [quotePickupAt, setQuotePickupAt] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [distance, setDistance] = useState<DistanceResult | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [tollAlternatives, setTollAlternatives] = useState<TollAlternative[]>([]);
  const [tollAlternativeId, setTollAlternativeId] = useState('');
  const [tollsLoading, setTollsLoading] = useState(false);
  const [tollsError, setTollsError] = useState('');

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === quoteVehicleId);
  const selectedRoute = routes.find((route) => route.id === quoteRouteId);
  const selectedTollAlternative = tollAlternatives.find((alternative) => alternative.id === tollAlternativeId);
  const hasFormula = selectedVehicle
    ? profiles.some((profile) => profile.vehicleId === selectedVehicle.id && profile.mode === quoteMode && profile.active)
    : false;

  useEffect(() => {
    if (!originLocationId || !destinationLocationId) {
      setDistance(null);
      setDistanceError('');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setDistanceLoading(true);
    setDistanceError('');
    fetch('/admin/api/location-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originLocationId, destinationLocationId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.result) {
          throw new Error(payload?.error ?? 'Mesafe çözümlenemedi.');
        }
        if (!cancelled) setDistance(payload.result as DistanceResult);
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDistance(null);
        setDistanceError(error instanceof Error ? error.message : 'Mesafe çözümlenemedi.');
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [originLocationId, destinationLocationId]);

  useEffect(() => {
    if (!quoteRouteId) {
      setTollAlternatives([]);
      setTollAlternativeId('');
      setTollsLoading(false);
      setTollsError('');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setTollsLoading(true);
    setTollsError('');
    const params = quoteVehicleId ? `?vehicleId=${encodeURIComponent(quoteVehicleId)}` : '';
    fetch(`/admin/api/pricing/tolls/route-alternatives/${quoteRouteId}${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.alternatives)) {
          throw new Error(payload?.error ?? 'Geçiş alternatifleri alınamadı.');
        }
        if (cancelled) return;
        const alternatives = payload.alternatives as TollAlternative[];
        setTollAlternatives(alternatives);
        setTollAlternativeId((current) => {
          if (alternatives.some((alternative) => alternative.id === current)) return current;
          return typeof payload.defaultAlternativeId === 'string' ? payload.defaultAlternativeId : '';
        });
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setTollAlternatives([]);
        setTollAlternativeId('');
        setTollsError(error instanceof Error ? error.message : 'Geçiş alternatifleri alınamadı.');
      })
      .finally(() => {
        if (!cancelled) setTollsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [quoteRouteId, quoteVehicleId]);

  const chooseRoute = (routeId: string) => {
    setQuoteRouteId(routeId);
    setTollAlternativeId('');
    const route = routes.find((item) => item.id === routeId);
    if (!route) return;
    // Older registered routes can still provide a toll alternative even when
    // their endpoints have not yet been mapped to the location catalogue.
    // Keep any manually selected endpoints in that case instead of losing the
    // route (and silently dropping its tolls).
    if (route.originLocationId) setOriginLocationId(route.originLocationId);
    if (route.destinationLocationId) setDestinationLocationId(route.destinationLocationId);
    if (!quoteVehicleId && route.defaultVehicleId) setQuoteVehicleId(route.defaultVehicleId);
  };

  const handleQuote = async () => {
    if (!originLocationId || !destinationLocationId) {
      setQuoteResult({ state: 'UNAVAILABLE', reason: 'MISSING_DISTANCE' });
      return;
    }
    setQuoting(true);
    setQuoteResult(null);
    try {
      const payload = {
        ...(quoteVehicleId ? { vehicleId: quoteVehicleId } : {}),
        ...(selectedRoute ? { routeId: selectedRoute.id } : {}),
        ...(selectedRoute && tollAlternativeId ? { tollAlternativeId } : {}),
        originLocationId,
        destinationLocationId,
        mode: quoteMode,
        tripType: quoteTripType,
        ...(quoteMode === 'HOURLY' ? { requestedHours: quoteHours } : {}),
        ...(quotePickupAt ? { pickupAt: new Date(quotePickupAt).toISOString() } : {})
      };
      const res = await fetch('/admin/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok || data.result) {
        setQuoteResult(data.result);
        if (data.distance) setDistance(data.distance);
      } else {
        setQuoteResult({ state: 'UNAVAILABLE', reason: data.error || 'Bilinmeyen Hata' });
      }
    } catch {
      setQuoteResult({ state: 'UNAVAILABLE', reason: 'Bağlantı hatası' });
    } finally {
      setQuoting(false);
    }
  };

  if (vehicles.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-900">Hızlı Teklif Simülatörü</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Henüz araç yok. Fiyat hesaplamak için önce araç ekleyin.</p>
        <Link href="/admin/araclar/yeni" className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">Araç Ekle</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
      <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-3">
        <Calculator className="text-blue-600" size={20} />
        <h2 className="text-base font-bold">Hızlı Teklif Simülatörü</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Araç</label>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={quoteVehicleId} onChange={e => setQuoteVehicleId(e.target.value)}>
            <option value="">Araç Seçin...</option>
            {vehicles.map((vehicle) => {
              const distanceProfile = profiles.some((profile) => profile.vehicleId === vehicle.id && profile.mode === quoteMode && profile.active);
              const suffix = !vehicle.priceCalculationEligible
                ? ' — talep üzerine'
                : distanceProfile ? '' : ' — formül yok';
              return <option key={vehicle.id} value={vehicle.id}>{vehicle.name}{suffix}</option>;
            })}
          </select>
          {selectedVehicle && !selectedVehicle.priceCalculationEligible && (
            <p className="mt-2 text-xs font-medium text-amber-700">Bu araç talep üzerine fiyatlandırılıyor; otomatik fiyat üretilmez.</p>
          )}
          {selectedVehicle?.priceCalculationEligible && !hasFormula && (
            <p className="mt-2 text-xs font-medium text-amber-700">Bu mod için henüz fiyat formülü tanımlanmamış. <a href="#pricing-profiles" className="font-bold underline">Formül oluşturun</a>.</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kayıtlı Rota ve Geçiş Senaryosu (isteğe bağlı)</label>
          <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={quoteRouteId} onChange={(event) => chooseRoute(event.target.value)}>
            <option value="">Rota seçmeyin — yalnız konumlarla hesaplayın</option>
            {routes.filter((route) => route.active).map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}{route.originLocationId && route.destinationLocationId ? '' : ' — konum eşleşmesi bekliyor'}
              </option>
            ))}
          </select>
          {selectedRoute && (!selectedRoute.originLocationId || !selectedRoute.destinationLocationId) && (
            <p className="mt-2 text-xs text-amber-700">Bu rotanın konum eşleşmesi eksik. Mesafe için aşağıdan kalkış ve varış seçin; seçili rota yine de geçiş maliyetini belirler.</p>
          )}
        </div>
        {selectedRoute && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" aria-live="polite">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5" htmlFor="quote-toll-alternative">
              Yol &amp; Geçiş Alternatifi
            </label>
            <select
              id="quote-toll-alternative"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm disabled:opacity-60"
              value={tollAlternativeId}
              disabled={tollsLoading || tollAlternatives.length === 0}
              onChange={(event) => setTollAlternativeId(event.target.value)}
            >
              {tollsLoading && <option>Alternatifler yükleniyor…</option>}
              {!tollsLoading && tollAlternatives.length === 0 && <option value="">Geçiş alternatifi yok</option>}
              {!tollsLoading && tollAlternatives.length > 0 && !tollAlternativeId && <option value="">Geçiş alternatifi seçin…</option>}
              {tollAlternatives.map((alternative) => (
                <option key={alternative.id} value={alternative.id}>
                  {alternative.isDefault ? 'Varsayılan — ' : ''}{alternative.name}
                </option>
              ))}
            </select>
            {tollsError ? (
              <p className="mt-2 text-xs font-medium text-red-700">{tollsError}</p>
            ) : tollAlternatives.length === 0 && !tollsLoading ? (
              <p className="mt-2 text-xs text-slate-600">Bu rota için geçiş maliyeti tanımlanmamış.</p>
            ) : selectedTollAlternative ? (
              <>
                <p className="mt-2 text-xs text-slate-600">
                  {selectedTollAlternative.pointNames.length
                    ? selectedTollAlternative.pointNames.join(' → ')
                    : 'Bu alternatifte ücretli geçiş bulunmuyor.'}
                </p>
                {selectedVehicle && selectedTollAlternative.isBannedForSelectedVehicle && (
                  <p className="mt-2 text-xs font-bold text-red-700">
                    Bu araç şu geçiş noktalarından geçemez (yasaklı sınıf): {selectedTollAlternative.bannedPointNames.join(', ')}. Lütfen bu noktaları içermeyen başka bir alternatif seçin.
                  </p>
                )}
                {selectedVehicle && !selectedTollAlternative.isBannedForSelectedVehicle && selectedTollAlternative.missingTariffPointNames.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-red-700">
                    Aktif/geçerli tarife eksik: {selectedTollAlternative.missingTariffPointNames.join(', ')}. Yanlış fiyat üretilmeyecek.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs font-medium text-amber-700">Fiyat hesabına geçmeden önce bu rota için bir geçiş alternatifi seçin.</p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kalkış</label>
            <select value={originLocationId} onChange={(event) => { setOriginLocationId(event.target.value); }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">Seçin...</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Varış</label>
            <select value={destinationLocationId} onChange={(event) => { setDestinationLocationId(event.target.value); }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm">
              <option value="">Seçin...</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}
            </select>
          </div>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${distance?.state === 'DEFINED_ROUTE' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
          {distanceLoading ? 'Mesafe koordinatlardan çözülüyor…' : distance?.state === 'DEFINED_ROUTE'
            ? `Doğrulanmış rota: ${distance.distanceKm} km`
            : distance?.state === 'ESTIMATED'
              ? `Koordinat tahmini: ${distance.distanceKm} km${distance.roadDistanceMultiplier ? ` (yol katsayısı ×${distance.roadDistanceMultiplier})` : ''}`
              : distanceError || 'İki kayıtlı konum seçildiğinde mesafe otomatik gelir.'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hesaplama</label>
             <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={quoteMode} onChange={e => setQuoteMode(e.target.value as 'DISTANCE' | 'HOURLY')}>
               <option value="DISTANCE">Mesafe</option>
               <option value="HOURLY">Saatlik Tahsis</option>
             </select>
           </div>
           <div>
             <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yön</label>
             <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={quoteTripType} onChange={e => setQuoteTripType(e.target.value as 'ONE_WAY' | 'ROUND_TRIP')}>
               <option value="ONE_WAY">Tek Yön</option>
               <option value="ROUND_TRIP">Çift Yön</option>
             </select>
           </div>
        </div>
        {quoteMode === 'HOURLY' && (
          <div className="grid grid-cols-2 gap-3">
            <AmountInput label="Süre (Saat)" value={quoteHours} onChange={setQuoteHours} symbol="sa" decimals={0} min={1} />
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alış Tarihi/Saati (isteğe bağlı — gündüz/gece geçiş tarifesini belirler)</label>
          <input type="datetime-local" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={quotePickupAt} onChange={e => setQuotePickupAt(e.target.value)} />
        </div>
        {profiles.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Henüz hiçbir fiyat formülü yok. Araç seçimi korunur; otomatik fiyat için <a href="#pricing-profiles" className="font-bold underline">ilk formülü oluşturun</a>.
          </div>
        )}
        <button onClick={handleQuote} disabled={!quoteVehicleId || !originLocationId || !destinationLocationId || distanceLoading || quoting || tollsLoading || (tollAlternatives.length > 0 && !tollAlternativeId) || Boolean(selectedTollAlternative && selectedVehicle && !selectedTollAlternative.isPricedForSelectedVehicle)} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 mt-2">
          {quoting ? <Loader2 className="animate-spin" size={18} /> : 'Hesapla'}
        </button>
      </div>

      {quoteResult && (
        <div className="mt-4 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {quoteResult.state === 'AVAILABLE' ? (
            <div className="space-y-4">
              {quoteResult.hasMissingTollData && (
                <div className="p-3.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Eksik Geçiş Ücreti Verisi</div>
                    <div className="text-xs mt-1 font-medium leading-relaxed">
                      Bu fiyata şu geçişler için tarife tanımlanmadığından hiç yansıtılmadı (0 TL varsayılmadı): {quoteResult.missingTollNames?.join(', ') || '—'}. Fiyatı tam yansıtmak için Yol &amp; Geçiş Ücretleri panelinden tarife girin.
                    </div>
                  </div>
                </div>
              )}
              {quoteResult.hasStaleTollData && (
                <div className="p-3.5 bg-orange-50 text-orange-800 rounded-xl border border-orange-200 flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm">Bayat Geçiş Ücreti Tarifesi</div>
                    <div className="text-xs mt-1 font-medium leading-relaxed">
                      Bu geçişlerin tarifesi uzun süredir güncellenmemiş veya yeni takvim yılına girildi, güncel olmayabilir: {quoteResult.staleTollNames?.join(', ') || '—'}.
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">MÜŞTERİ FİYATI</span>
                <span className="text-3xl font-black text-emerald-900">{formatMoneyCents(quoteResult.quotedEurCents || 0, 'EUR')}</span>
                <div className="flex gap-3 mt-3 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-emerald-100/50">
                  <span>{formatMoneyCents(quoteResult.quotedUsdCents || 0, 'USD')}</span>
                  <span className="text-slate-300">|</span>
                  <span>{formatMoneyCents(quoteResult.quotedTryKurus || 0, 'TRY')}</span>
                </div>
              </div>
              
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-sm">
                <div className="font-bold text-slate-900 text-[10px] uppercase tracking-wider mb-2">Formül Çıktısı ({quoteResult.formulaKind})</div>
                {quoteResult.lines?.map((line, i) => (
                   <div key={i} className="flex justify-between items-center text-slate-600">
                     <span>{line.label}</span>
                     <span className="font-medium text-slate-900">{formatMoneyCents(line.amountKurus, 'TRY')}</span>
                   </div>
                ))}
                <div className="border-t border-slate-200 pt-2.5 mt-2.5 flex justify-between font-bold text-slate-900">
                  <span>Net Toplam</span>
                  <span>{formatMoneyCents(quoteResult.netTryKurus || 0, 'TRY')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>KDV</span>
                  <span>{formatMoneyCents(quoteResult.vatTryKurus || 0, 'TRY')}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 pt-1">
                  <span>Brüt Toplam</span>
                  <span>{formatMoneyCents(quoteResult.grossTryKurus || 0, 'TRY')}</span>
                </div>
                  <div className="border-t border-slate-200 pt-2.5 mt-2.5 flex justify-between text-slate-600">
                    <span>Ham EUR karşılığı</span>
                    <span className="font-medium text-slate-900">{formatMoneyCents(quoteResult.rawEurCents || 0, 'EUR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Yuvarlanmış EUR</span>
                    <span className="font-medium text-slate-900">{formatMoneyCents(quoteResult.quotedEurCents || 0, 'EUR')}</span>
                  </div>
              </div>
            </div>
          ) : quoteResult.state === 'ON_REQUEST' ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div><div className="font-bold text-sm">Talep Üzerine Fiyatlandırma</div><div className="text-xs mt-1 font-medium">Seçili araç otomatik hesaplamaya dahil değil. Yönetici manuel teklif oluşturmalıdır.</div></div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Hesaplama Yapılamadı</div>
                <div className="text-xs mt-1 font-medium">{getReasonText(quoteResult.reason)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TcmbWidget({ settings, onApply }: { settings: Settings | null, onApply: () => void }) {
  const [previewData, setPreviewData] = useState<ExchangeRatePreview | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/pricing/exchange-rates', {
        method: 'POST', body: JSON.stringify({ action: 'preview' })
      });
      const data: unknown = await res.json();
      if (isExchangeRatePreview(data)) {
        setPreviewData(data);
        setConfirmText('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/pricing/exchange-rates', {
        method: 'POST', body: JSON.stringify({ action: 'apply', confirmationText: confirmText })
      });
      if (res.ok) {
        setPreviewData(null);
        onApply();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-3">
          <RefreshCw className="text-slate-400" size={20} />
          <h2 className="text-base font-bold">Canlı TCMB Kurları</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">EUR/TRY</div>
             <div className="text-lg font-black text-slate-900">{settings?.latestTcmb ? formatMicros(settings.latestTcmb.eurTryMicros) : '---'}</div>
           </div>
           <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">EUR/USD</div>
             <div className="text-lg font-black text-slate-900">{settings?.latestTcmb ? formatMicros(settings.latestTcmb.eurUsdMicros) : '---'}</div>
           </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
           Son Güncel: {settings?.latestTcmb ? new Date(settings.latestTcmb.fetchedAt).toLocaleString('tr-TR') : 'Bilinmiyor'}
        </div>
        
        <button onClick={handlePreview} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={16}/> : 'Güncel Kuru Çek'}
        </button>
      </div>

      {previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-5">Yeni Kur Onayı</h3>
            <div className="space-y-4 mb-6">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">YENİ EUR/TRY</div>
                     <div className="text-xl font-black text-slate-900">{formatMicros(previewData.candidate.eurTryMicros)}</div>
                     {previewData.deviation && (
                       <div className="text-xs font-bold text-blue-600 mt-1">Sapma: %{(previewData.deviation.eurTry / 100).toFixed(2)}</div>
                     )}
                   </div>
                   <div>
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">YENİ EUR/USD</div>
                     <div className="text-xl font-black text-slate-900">{formatMicros(previewData.candidate.eurUsdMicros)}</div>
                     {previewData.deviation && (
                       <div className="text-xs font-bold text-blue-600 mt-1">Sapma: %{(previewData.deviation.eurUsd / 100).toFixed(2)}</div>
                     )}
                   </div>
                 </div>
               </div>
               <p className="text-sm font-medium text-slate-600 leading-relaxed">
                 TCMB kurlarını sisteme yansıtmak üzeresiniz. Onaylamak için kutuya <strong className="text-slate-900">KURU UYGULA</strong> yazın.
               </p>
               <input 
                 type="text" 
                 className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold uppercase focus:outline-none focus:border-blue-500 shadow-sm" 
                 value={confirmText}
                 onChange={e => setConfirmText(e.target.value)}
                 placeholder="KURU UYGULA"
               />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreviewData(null)} className="flex-1 py-3 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">İptal</button>
              <button onClick={handleApply} disabled={confirmText !== 'KURU UYGULA' || loading} className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18}/> : 'Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsPanel({ settings, onSave }: { settings: Settings | null, onSave: () => void }) {
  const [edit, setEdit] = useState<PricingSettingsDraft>({
    vatRate: 20,
    vatMode: 'INCLUDED',
    eurRounding: 500,
    usdRounding: 500,
    tryRounding: 5000,
    eurTryMode: 'LIVE',
    eurUsdMode: 'LIVE',
    manualEurTry: 0,
    manualEurUsd: 0,
    refreshMinutes: 60,
    deviationLimit: 10,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && settings.policy && settings.exchangeRates) {
      setEdit({
        vatRate: settings.policy.vatRateBasisPoints / 100,
        vatMode: settings.policy.vatDisplayMode,
        eurRounding: settings.policy.eurRoundingKurus,
        usdRounding: settings.policy.usdRoundingCents,
        tryRounding: settings.policy.tryRoundingKurus,
        eurTryMode: settings.exchangeRates.eurTryMode,
        eurUsdMode: settings.exchangeRates.eurUsdMode,
        manualEurTry: settings.exchangeRates.manualEurTryMicros ? settings.exchangeRates.manualEurTryMicros / 1000000 : 0,
        manualEurUsd: settings.exchangeRates.manualEurUsdMicros ? settings.exchangeRates.manualEurUsdMicros / 1000000 : 0,
        refreshMinutes: settings.exchangeRates.refreshMinutes,
        deviationLimit: settings.exchangeRates.deviationBasisPoints / 100
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const payload = {
        vatRateBasisPoints: Math.round(edit.vatRate * 100),
        vatDisplayMode: edit.vatMode,
        eurRoundingKurus: edit.eurRounding,
        usdRoundingCents: edit.usdRounding,
        tryRoundingKurus: edit.tryRounding,
        eurTryMode: edit.eurTryMode,
        eurUsdMode: edit.eurUsdMode,
        manualEurTryMicros: edit.eurTryMode === 'MANUAL' ? Math.round(edit.manualEurTry * 1000000) : null,
        manualEurUsdMicros: edit.eurUsdMode === 'MANUAL' ? Math.round(edit.manualEurUsd * 1000000) : null,
        refreshMinutes: edit.refreshMinutes,
        deviationBasisPoints: Math.round(edit.deviationLimit * 100)
      };
      await fetch('/admin/api/pricing/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kur ve Maliyet Politikası</h2>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">Motor genelinde kullanılacak KDV ve yuvarlama standartları.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
          {saving ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>} Kaydet
        </button>
      </div>
      
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Vergi ve Yuvarlama</h3>
           <AmountInput label="KDV Oranı (%)" value={edit.vatRate * 10} onChange={v => setEdit({...edit, vatRate: v / 10})} symbol="%" decimals={1} />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">KDV Modu</label>
              <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={edit.vatMode} onChange={e => setEdit({...edit, vatMode: e.target.value as PricingSettingsDraft['vatMode']})}>
              <option value="INCLUDED">Fiyatlara Dahil</option>
              <option value="EXCLUDED">Fiyatlara Hariç (+KDV)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <AmountInput label="EUR Yuvarlama" value={edit.eurRounding} onChange={v => setEdit({...edit, eurRounding: v})} symbol="€" decimals={2} min={1} />
            <AmountInput label="USD Yuvarlama" value={edit.usdRounding} onChange={v => setEdit({...edit, usdRounding: v})} symbol="$" decimals={2} min={1} />
          </div>
          <AmountInput label="TRY Yuvarlama Adımı" value={edit.tryRounding} onChange={v => setEdit({...edit, tryRounding: v})} symbol="₺" decimals={2} min={1} />
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Döviz Kaynakları</h3>
          <div>
             <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">EUR/TRY Kur Kaynağı</label>
             <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={edit.eurTryMode} onChange={e => setEdit({...edit, eurTryMode: e.target.value as PricingSettingsDraft['eurTryMode']})}>
               <option value="LIVE">TCMB Canlı</option>
               <option value="MANUAL">Manuel Sabit</option>
             </select>
          </div>
          {edit.eurTryMode === 'MANUAL' && (
              <AmountInput label="Sabit EUR/TRY" value={edit.manualEurTry * 10_000} onChange={v => setEdit({...edit, manualEurTry: v / 10_000})} symbol="₺" decimals={4} min={1} />
          )}
          
          <div className="pt-2">
             <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">EUR/USD Kur Kaynağı</label>
             <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" value={edit.eurUsdMode} onChange={e => setEdit({...edit, eurUsdMode: e.target.value as PricingSettingsDraft['eurUsdMode']})}>
               <option value="LIVE">TCMB Canlı</option>
               <option value="MANUAL">Manuel Sabit</option>
             </select>
          </div>
          {edit.eurUsdMode === 'MANUAL' && (
              <AmountInput label="Sabit EUR/USD" value={edit.manualEurUsd * 10_000} onChange={v => setEdit({...edit, manualEurUsd: v / 10_000})} symbol="$" decimals={4} min={0.1} />
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">TCMB Otomasyonu</h3>
          <AmountInput label="Yenileme Sıklığı" value={edit.refreshMinutes} onChange={v => setEdit({...edit, refreshMinutes: v})} symbol="dk" decimals={0} min={5} />
          <AmountInput label="Sapma Uyarı Sınırı" value={edit.deviationLimit * 100} onChange={v => setEdit({...edit, deviationLimit: v/100})} symbol="%" decimals={1} min={0} />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Sapma sınırı aşıldığında sistem otomatik güncellemeyi durdurur ve yöneticiden onay bekler.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfilesPanel({ profiles, vehicles, onReload }: { profiles: Profile[], vehicles: Vehicle[], onReload: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cloneData, setCloneData] = useState<Profile | null>(null);

  const toggleActive = async (p: Profile) => {
    try {
      await fetch('/admin/api/pricing/profiles', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, active: !p.active })
      });
      onReload();
    } catch {}
  };

  return (
    <div id="pricing-profiles" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hesaplama Formülleri</h2>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">Araçların mesafe ve tahsis bazlı fiyat kuralları.</p>
        </div>
        <button onClick={() => { setCloneData(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
          <Plus size={16}/> Yeni Formül
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Araç Sınıfı</th>
              <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Mod</th>
              <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ücret Matrisi</th>
              <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">Durum</th>
              <th className="py-3.5 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium">
            {profiles.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-bold">Kayıtlı formül bulunamadı.</td></tr>
            ) : (
              profiles.map(p => {
                const isDist = p.mode === 'DISTANCE';
                const v = vehicles.find(x => x.id === p.vehicleId);
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${!p.active ? 'opacity-60 grayscale-[50%]' : ''}`}>
                    <td className="py-4 px-5 font-bold text-slate-900">{v?.name || 'Bilinmeyen'}</td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest ${isDist ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {isDist ? 'MESAFE' : 'SAATLİK'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-sm text-slate-600 leading-relaxed">
                      {p.mode === 'DISTANCE' ? (
                        <div className="flex gap-4">
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">Açılış</span><br/><span className="font-bold text-slate-900">{formatMoneyCents(p.distanceOpeningKurus, 'TRY')}</span></div>
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">İlk {p.distanceThresholdKm}km</span><br/><span className="font-bold text-slate-900">{formatMoneyCents(p.distanceFirstKmKurus, 'TRY')}<span className="text-xs text-slate-400">/km</span></span></div>
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">Sonrası</span><br/><span className="font-bold text-slate-900">{formatMoneyCents(p.distanceSecondKmKurus > 0 ? p.distanceSecondKmKurus : p.distanceFirstKmKurus, 'TRY')}<span className="text-xs text-slate-400">/km</span></span>{p.distanceSecondKmKurus === 0 && <div className="text-[9px] font-bold text-blue-600">ilk tarife devam eder</div>}</div>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">Saatlik (Min {p.minimumHours}s)</span><br/><span className="font-bold text-slate-900">{formatMoneyCents(p.hourlyRateKurus, 'TRY')}</span></div>
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">Dahil KM</span><br/><span className="font-bold text-slate-900">{p.includedKm} <span className="text-xs text-slate-500 font-medium">{p.includedKmMode === 'PER_HOUR' ? 'saat başı' : 'toplam'}</span></span></div>
                          <div><span className="text-[10px] font-bold text-slate-400 uppercase">Aşım Bedelleri</span><br/><span className="font-bold text-slate-900">{formatMoneyCents(p.excessHourKurus, 'TRY')}<span className="text-xs text-slate-400">/s</span> &middot; {formatMoneyCents(p.excessKmKurus, 'TRY')}<span className="text-xs text-slate-400">/km</span></span></div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${p.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {p.active ? 'AKTİF' : 'PASİF'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex justify-end gap-1">
                         <button onClick={() => {setCloneData(p); setModalOpen(true);}} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Yeni Formül Olarak Çoğalt"><Edit2 size={16}/></button>
                         <button onClick={() => toggleActive(p)} className={`p-2 rounded-lg transition-colors ${p.active ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={p.active ? 'Pasife Al' : 'Aktifleştir'}>
                           {p.active ? <X size={16}/> : <Check size={16}/>}
                         </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ProfileModal 
          isOpen={modalOpen} 
          cloneData={cloneData} 
          vehicles={vehicles}
          onClose={() => setModalOpen(false)} 
          onSaved={() => { setModalOpen(false); onReload(); }} 
        />
      )}
    </div>
  );
}

function ProfileModal({ isOpen, cloneData, vehicles, onClose, onSaved }: {
  isOpen: boolean;
  cloneData: Profile | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  
  const [fMode, setFMode] = useState<'DISTANCE' | 'HOURLY'>('DISTANCE');
  const [fVehicleId, setFVehicleId] = useState('');
  const [fActive, setFActive] = useState(true);
  const [fNotes, setFNotes] = useState('');

  // DISTANCE
  const [fOpening, setFOpening] = useState(0);
  const [fFirst, setFFirst] = useState(0);
  const [fThreshold, setFThreshold] = useState(100);
  const [fSecond, setFSecond] = useState(0);

  // HOURLY
  const [fHourlyRate, setFHourlyRate] = useState(0);
  const [fMinHours, setFMinHours] = useState(4);
  const [fIncludedMode, setFIncludedMode] = useState<'PER_HOUR' | 'PACKAGE'>('PER_HOUR');
  const [fIncludedKm, setFIncludedKm] = useState(10);
  const [fExcessKm, setFExcessKm] = useState(0);
  const [fExcessHour, setFExcessHour] = useState(0);

  useEffect(() => {
    if (isOpen && cloneData) {
      setFMode(cloneData.mode);
      setFVehicleId(cloneData.vehicleId);
      setFActive(cloneData.active);
      setFNotes(cloneData.notes || '');
      if (cloneData.mode === 'DISTANCE') {
        setFOpening(cloneData.distanceOpeningKurus);
        setFFirst(cloneData.distanceFirstKmKurus);
        setFThreshold(cloneData.distanceThresholdKm);
        setFSecond(cloneData.distanceSecondKmKurus);
      } else {
        setFHourlyRate(cloneData.hourlyRateKurus);
        setFMinHours(cloneData.minimumHours);
        setFIncludedMode(cloneData.includedKmMode);
        setFIncludedKm(cloneData.includedKm);
        setFExcessKm(cloneData.excessKmKurus);
        setFExcessHour(cloneData.excessHourKurus);
      }
    } else if (isOpen) {
      setFMode('DISTANCE'); setFVehicleId(''); setFActive(true); setFNotes('');
      setFOpening(0); setFFirst(0); setFThreshold(100); setFSecond(0);
      setFHourlyRate(0); setFMinHours(4); setFIncludedMode('PER_HOUR'); setFIncludedKm(10); setFExcessKm(0); setFExcessHour(0);
    }
  }, [isOpen, cloneData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ProfilePayload = {
        vehicleId: fVehicleId, active: fActive, mode: fMode, notes: fNotes || null
      };
      if (fMode === 'DISTANCE') {
        payload.distanceOpeningKurus = fOpening;
        payload.distanceFirstKmKurus = fFirst;
        payload.distanceThresholdKm = fThreshold;
        payload.distanceSecondKmKurus = fSecond;
      } else {
        payload.hourlyRateKurus = fHourlyRate;
        payload.minimumHours = fMinHours;
        payload.includedKmMode = fIncludedMode;
        payload.includedKm = fIncludedKm;
        payload.excessKmKurus = fExcessKm;
        payload.excessHourKurus = fExcessHour;
      }
      
      const res = await fetch('/admin/api/pricing/profiles', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 rounded-t-2xl shrink-0">
          <h2 className="text-lg font-black text-slate-900">
            {cloneData ? 'Formülü Çoğalt' : 'Yeni Fiyat Formülü'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Araç Sınıfı</label>
               <select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm">
                 <option value="">Seçiniz...</option>
                  {vehicles.filter((v: Vehicle) => v.priceCalculationEligible).map((v: Vehicle) => <option key={v.id} value={v.id}>{v.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hesaplama Modu</label>
               <select value={fMode} onChange={e => setFMode(e.target.value as 'DISTANCE'|'HOURLY')} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm">
                 <option value="DISTANCE">Mesafe Bazlı</option>
                 <option value="HOURLY">Saatlik Tahsis</option>
               </select>
             </div>
           </div>

           <div className="border-t border-slate-100 pt-6">
             {fMode === 'DISTANCE' ? (
               <div className="space-y-4 animate-in fade-in">
                 <div className="grid grid-cols-2 gap-4">
                   <AmountInput label="Açılış Ücreti" value={fOpening} onChange={setFOpening} symbol="₺" />
                   <AmountInput label="Kademe Sınırı (KM)" value={fThreshold} onChange={setFThreshold} symbol="km" decimals={0} min={1} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <AmountInput label="İlk Kademe KM Ücreti" value={fFirst} onChange={setFFirst} symbol="₺" />
                   <AmountInput label="İkinci Kademe KM Ücreti" value={fSecond} onChange={setFSecond} symbol="₺" />
                 </div>
                 <DistanceExamples opening={fOpening} first={fFirst} threshold={fThreshold} second={fSecond} />
               </div>
             ) : (
               <div className="space-y-4 animate-in fade-in">
                 <div className="grid grid-cols-2 gap-4">
                   <AmountInput label="Saatlik Temel Ücret" value={fHourlyRate} onChange={setFHourlyRate} symbol="₺" />
                   <AmountInput label="Minimum Süre (Saat)" value={fMinHours} onChange={setFMinHours} symbol="sa" decimals={0} min={1} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dahil KM Tipi</label>
                     <select value={fIncludedMode} onChange={e => setFIncludedMode(e.target.value as 'PER_HOUR'|'PACKAGE')} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm">
                       <option value="PER_HOUR">Saat Başına</option>
                       <option value="PACKAGE">Paket Toplamı</option>
                     </select>
                   </div>
                   <AmountInput label={fIncludedMode === 'PER_HOUR' ? "Saat Başı Dahil" : "Toplam Dahil"} value={fIncludedKm} onChange={setFIncludedKm} symbol="km" decimals={0} />
                 </div>
                 <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-4">
                   <AmountInput label="Saat Aşım Ücreti (Saatlik)" value={fExcessHour} onChange={setFExcessHour} symbol="₺" />
                   <AmountInput label="KM Aşım Ücreti (KM Başı)" value={fExcessKm} onChange={setFExcessKm} symbol="₺" />
                 </div>
               </div>
             )}
           </div>

           <div className="border-t border-slate-100 pt-6">
             <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">İç Notlar (Müşteriye Gösterilmez)</label>
             <textarea 
               rows={2} 
               value={fNotes} 
               onChange={e => setFNotes(e.target.value)} 
               className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm resize-none"
             />
           </div>
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl shrink-0 flex justify-end gap-3">
           <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">İptal</button>
           <button onClick={handleSave} disabled={!fVehicleId || saving} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-2">
             {saving ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>} {saving ? 'Kaydediliyor...' : 'Oluştur'}
           </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function FormulaPricingClient() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<PricingRoute[]>([]);
  const [locations, setLocations] = useState<PricingLocation[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setProfilesError('');
    setSettingsError('');
    const requestJson = async (url: string) => {
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'Sunucu veriyi döndüremedi.');
      return payload;
    };
    const [profilesResponse, settingsResponse] = await Promise.allSettled([
      requestJson('/admin/api/pricing/profiles'),
      requestJson('/admin/api/pricing/settings'),
    ]);
    if (profilesResponse.status === 'fulfilled') {
      const payload = profilesResponse.value;
      if (!Array.isArray(payload?.profiles) || !Array.isArray(payload?.vehicles)) {
        setProfiles([]);
        setVehicles([]);
        setRoutes([]);
        setLocations([]);
        setProfilesError('Araç ve fiyat profili verisi beklenen biçimde alınamadı.');
      } else {
        setProfiles(payload.profiles);
        setVehicles(payload.vehicles);
        setRoutes(Array.isArray(payload.routes) ? payload.routes : []);
        setLocations(Array.isArray(payload.locations) ? payload.locations : []);
      }
    } else {
      setProfiles([]);
      setVehicles([]);
      setRoutes([]);
      setLocations([]);
      setProfilesError(profilesResponse.reason instanceof Error ? profilesResponse.reason.message : 'Araç ve fiyat profili verisi alınamadı.');
    }
    if (settingsResponse.status === 'fulfilled') {
      const payload = settingsResponse.value;
      setSettings({
        policy: payload.policy ?? null,
        exchangeRates: payload.exchangeRates ?? null,
        latestTcmb: payload.latestTcmb ?? null,
      });
    } else {
      setSettings(null);
      setSettingsError(settingsResponse.reason instanceof Error ? settingsResponse.reason.message : 'Kur ve ayar verisi alınamadı.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-bold tracking-wide">
          <Loader2 className="animate-spin" size={24} />
          Sistem Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fiyatlandırma Motoru</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Araç sınıfları için formül ve kur parametrelerini yönetin.</p>
        </div>
      </div>
      {(profilesError || settingsError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold">Bazı fiyatlandırma verileri yüklenemedi</div>
          {profilesError && <p className="mt-1">Araçlar ve formüller: {profilesError}</p>}
          {settingsError && <p className="mt-1">Kur ve ayarlar: {settingsError}</p>}
          <button type="button" onClick={loadData} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"><RefreshCw size={14} /> Yeniden Dene</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <FastQuotePanel vehicles={vehicles} profiles={profiles} routes={routes} locations={locations} />
          <TcmbWidget settings={settings} onApply={loadData} />
        </div>
        
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <SettingsPanel settings={settings} onSave={loadData} />
          <ProfilesPanel profiles={profiles} vehicles={vehicles} onReload={loadData} />
        </div>
      </div>

    </div>
  );
}
