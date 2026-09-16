'use client';

import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { 
  MapPin, Navigation, Plus, Save,
  RefreshCw, Check, X, AlertCircle, Loader2, Car, ShieldCheck, Settings2,
  Trash2, KeyRound, Edit2, PowerOff, Power
} from 'lucide-react';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';
import { AdminRecordActions } from '@/app/admin/_components/AdminRecordActions';
import { TOLL_VEHICLE_CLASS_LABELS, TOLL_VEHICLE_CLASS_SELECTION_WARNING } from '@/lib/toll-vehicle-classes';
import { isAutomaticTollSyncSupported } from '@/lib/toll-tariff-sync-support';
import { availableGatePairs, gatePairKey, isExactGatePair } from '@/lib/toll-gate-pairs';

// --- Types ---
type TollPoint = {
  id: string;
  name: string;
  type: 'BRIDGE' | 'TUNNEL' | 'HIGHWAY' | 'FERRY';
  active: boolean;
  // Per-point day/night cutover hours (0-23); null on both means this point
  // has no day/night differentiation (its tariffs are entered as ALL/DAY).
  dayStartHour: number | null;
  nightStartHour: number | null;
  // Business-rule note, e.g. "ağır araçlar geçemez" — a genuine "not
  // applicable" restriction, distinct from a tariff that is simply missing.
  notes: string | null;
  // Which vehicle-classification system applies at this point (e.g. "KGM
  // Resmî Sınıf 1-6" or a note documenting a divergent operator scheme).
  classificationLabel: string | null;
  // null = unconfirmed (ask owner); [] = confirmed nothing banned; non-empty
  // = confirmed banned class list. A banned class can never be priced here.
  bannedVehicleClasses: string[] | null;
  bannedVehicleClassesSourceUrl: string | null;
  // A SEPARATE, independent ban axis from bannedVehicleClasses: some
  // operators ban a whole fleet vehicle TYPE (minivan/minibus/midibus/bus)
  // categorically, regardless of axle-based class (e.g. Avrasya Tüneli bans
  // "Otobüs" outright even though a 2-axle bus would otherwise share
  // class_1/class_2 with an allowed car). Same null/[]/list semantics.
  // null = unconfirmed (a round trip here still uses the legacy "double the
  // forward tariff" behavior, flagged to the admin as unconfirmed).
  tollDirection: 'ONE_WAY' | 'TWO_WAY_SAME' | 'TWO_WAY_DIRECTIONAL' | null;
  tollDirectionSourceUrl: string | null;
  tollDirectionNotes: string | null;
  // FLAT = one tariff amount per class (the vast majority of points).
  // GATE_PAIR = calculator-based corridor with no flat table; tariffs are
  // keyed by entry+exit gate name instead (e.g. OTOYOL A.Ş. toll roads).
  pricingMode: 'FLAT' | 'GATE_PAIR';
  createdAt: string;
  updatedAt: string;
};

function vehicleClassLabel(vc: string) {
  return (TOLL_VEHICLE_CLASS_LABELS as Record<string, string>)[vc] ?? vc;
}


type TollTimeBand = 'ALL' | 'DAY' | 'NIGHT';

type TollTariff = {
  id: string;
  tollPointId: string;
  vehicleClass: string;
  displayOrder: number;
  timeBand: TollTimeBand;
  amountKurus: number | null;
  automaticAmountKurus: number | null;
  manualAmountKurus: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceVerified: boolean;
  sourceFetchedAt: string | null;
  manualUpdatedAt: string | null;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  /** When validFrom is empty (source states no effective date, e.g. a live gate-pair calculator), the date this amount was personally queried. */
  queriedAt?: string | null;
  updatedAt: string;
  updatedByName?: string | null;
  lastSyncError?: string | null;
  stale?: boolean;
  staleReasons?: ('AGE' | 'YEAR_ROLLOVER' | 'SOURCE_EFFECTIVE_DATE_OLD' | 'QUERY_DATE_OLD')[];
  lastReviewedAt?: string;
  // Only meaningful when the owning point's pricingMode is GATE_PAIR.
  entryGateName?: string | null;
  exitGateName?: string | null;
  direction?: 'FORWARD' | 'BACKWARD' | null;
};

type TollSettings = {
  staleAfterDays: number;
  warnOnNewYearRollover: boolean;
};

type TollIntegrationSettings = {
  id: number;
  organizationName: string;
  serviceUrl: string;
  active: boolean;
  apiCodeConfigured: boolean;
  maskedApiCode: string | null;
  updatedAt: string;
};

const TIME_BAND_LABELS: Record<TollTimeBand, string> = { ALL: 'Tüm Gün', DAY: 'Gündüz', NIGHT: 'Gece' };
const closedSystemPricingMode = (type: TollPoint['type']): TollPoint['pricingMode'] =>
  type === 'HIGHWAY' || type === 'FERRY' ? 'GATE_PAIR' : 'FLAT';
type SyncPreview = {
  newAmountKurus?: number | null;
  amountKurus?: number | null;
  requiresConfirmation?: boolean;
  previewToken?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  queriedAt?: string;
};

type TollAlternative = {
  id: string;
  routeId: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  displayOrder: number;
  pointIds: string[];
  // Keyed by tollPointId; only present for points whose pricingMode is
  // GATE_PAIR — the specific entry/exit gate this alternative uses there.
  gatePairs?: Record<string, { entryGateName: string, exitGateName: string }>;
  // True when this alternative was entered speculatively (e.g. a plausible
  // but unconfirmed station/route) and the owner has not yet confirmed it.
  needsReview?: boolean;
  reviewNote?: string | null;
};

type Route = {
  id: string;
  name: string;
  active: boolean;
};

type DataPayload = {
  points: TollPoint[];
  tariffs: TollTariff[];
  alternatives: TollAlternative[];
  routes: Route[];
  vehicleClasses: string[];
  settings: TollSettings;
};

const GATE_PAIR_MISSING_WARNING = 'Önce Geçiş Noktaları ve Maliyetler bölümünde bu nokta için gişe çifti tarifesi ekleyin';

type BulkIncreasePreview = {
  tollPointId: string;
  tollPointName: string;
  normalizedPercentage: string;
  idempotencyKey: string;
  previewHash: string;
  skippedEmptyCount: number;
  rows: {
    tariffId: string;
    vehicleClass: string;
    timeBand: string;
    oldAmountKurus: number;
    newAmountKurus: number;
  }[];
};

// --- Helpers ---
const formatTRY = (kurus?: number | null) => 
  kurus != null 
    ? (kurus / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }) 
    : '---';

const formatTRYInput = (kurus?: number | null) =>
  kurus != null
    ? (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
    : '';

function parseTRYInput(value: string) {
  const compact = value.trim().replace(/\s/g, '');
  if (!compact) return null;
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function BulkIncreaseCard({ point, onRefresh }: { point: TollPoint; onRefresh: () => void }) {
  const [percentage, setPercentage] = useState('');
  const [preview, setPreview] = useState<BulkIncreasePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setPercentage('');
    setPreview(null);
    setError('');
    setSuccess('');
  }, [point.id]);

  const post = async (body: object) => {
    const response = await fetch('/admin/api/pricing/tolls/bulk-increase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.error ?? 'Toplu zam işlemi tamamlanamadı.');
    return json;
  };

  const handlePreview = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await post({ action: 'PREVIEW', tollPointId: point.id, percentage });
      setPreview(result as BulkIncreasePreview);
    } catch (cause) {
      setPreview(null);
      setError(errorMessage(cause, 'Önizleme oluşturulamadı.'));
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await post({
        action: 'APPLY',
        tollPointId: point.id,
        percentage,
        previewHash: preview.previewHash,
        idempotencyKey: preview.idempotencyKey,
      });
      setSuccess(result.alreadyApplied
        ? 'Bu zam daha önce uygulanmıştı; ikinci kez uygulanmadı.'
        : `${result.rows.length} tarife aynı kayıtlar üzerinde güncellendi.`);
      setPreview(null);
      onRefresh();
    } catch (cause) {
      setError(errorMessage(cause, 'Zam uygulanamadı.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="bulk-increase-card" className="mx-4 mt-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm md:mx-6 md:mt-6 md:p-5">
      <div className="mb-4">
        <h4 className="text-base font-black text-slate-900">Toplu Yüzde Zam</h4>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
          Yalnız fiyatı bulunan güncel tarifeleri yerinde günceller. Boş tarifeler değişmez.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="bulk-increase-percentage" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Zam Oranı (%)</label>
          <input
            id="bulk-increase-percentage"
            data-testid="bulk-increase-percentage"
            inputMode="decimal"
            value={percentage}
            onChange={(event) => { setPercentage(event.target.value); setPreview(null); setError(''); setSuccess(''); }}
            placeholder="Örn. 15 veya 12,5"
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-bold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button
          data-testid="bulk-increase-preview"
          onClick={handlePreview}
          disabled={busy || !percentage.trim()}
          className="min-h-11 self-end rounded-lg border border-blue-200 bg-white px-5 py-2 text-sm font-black text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:opacity-50"
        >
          {busy ? 'Hazırlanıyor...' : 'Önizle'}
        </button>
      </div>

      {preview && (
        <div data-testid="bulk-increase-preview-list" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
          <div className="mb-3 flex flex-col gap-1 text-xs font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span><strong className="text-slate-900">{preview.rows.length}</strong> satır güncellenecek</span>
            <span><strong className="text-slate-900">{preview.skippedEmptyCount}</strong> boş satır atlanacak</span>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {preview.rows.map((row) => (
              <div key={row.tariffId} className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-bold text-slate-700">{vehicleClassLabel(row.vehicleClass)} · {TIME_BAND_LABELS[row.timeBand as TollTimeBand] ?? row.timeBand}</span>
                <span className="whitespace-nowrap font-black text-slate-900">
                  {formatTRY(row.oldAmountKurus)} <span className="px-1 text-blue-500">→</span> {formatTRY(row.newAmountKurus)}
                </span>
              </div>
            ))}
            {preview.rows.length === 0 && <p className="py-2 text-sm font-bold text-amber-700">Güncellenecek dolu tarife bulunmuyor.</p>}
          </div>
          <AdminActionButton
            label={busy ? 'Uygulanıyor...' : 'Zammı Uygula'}
            icon={Save}
            variant="save"
            onClick={handleApply}
            disabled={preview.rows.length === 0}
            loading={busy}
            testId="bulk-increase-apply"
            className="mt-4 w-full"
          />
        </div>
      )}
      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
      {success && <div role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{success}</div>}
    </div>
  );
}

function AmountInput({ valueKurus, onChange, label }: { valueKurus: number | null, onChange: (val: number | null) => void, label?: string }) {
  const [str, setStr] = useState(valueKurus != null ? (valueKurus / 100).toFixed(2) : '');
  const inputId = useId();

  useEffect(() => {
    setStr(valueKurus != null ? (valueKurus / 100).toFixed(2) : '');
  }, [valueKurus]);

  const handleBlur = () => {
    if (!str.trim()) {
      onChange(null);
      return;
    }
    const parsed = parseFloat(str.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      setStr(valueKurus != null ? (valueKurus / 100).toFixed(2) : '');
      return;
    }
    onChange(Math.round(parsed * 100));
    setStr(parsed.toFixed(2));
  };

  return (
    <div>
      {label && <label htmlFor={inputId} className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}
      <div className="relative">
        <input
          id={inputId}
          type="text" 
          value={str} 
          onChange={e => setStr(e.target.value)}
          onBlur={handleBlur}
          className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm"
          placeholder="0.00"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black uppercase pointer-events-none">TRY</span>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative my-auto">
         <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <X size={20} />
         </button>
         <h3 className="text-xl font-black text-slate-900 mb-5 tracking-tight">{title}</h3>
         {children}
      </div>
    </div>
  );
}

// --- Sub-Components ---

function AdvancedSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/70">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-700 marker:content-none">
        <span>{title}</span>
        <Settings2 size={17} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-slate-200 p-4">
        {children}
      </div>
    </details>
  );
}

// Tri-state banned-classes editor, shared by PointForm and PointDetail.
// null = unconfirmed (ask owner); [] = confirmed no restriction; non-empty =
// confirmed banned list — the latter two require a source URL.
// Tri-state banned VEHICLE-TYPE editor — a separate, independent axis from
// Tolling-direction editor, shared by PointForm and PointDetail. Mirrors the
// tri-state pattern of BannedClassesEditor: null = unconfirmed (fiyat motoru
// bunu bilgilendirici bir uyarıyla birlikte eski davranışa — gidiş tarifesini
// ikiye katlama — devam eder), her doğrulanmış seçim resmî bir kaynak ister.
function PointForm({ onSave, onClose }: { onSave: (point: TollPoint) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<{ name: string, type: string, active: boolean, dayStartHour: number | null, nightStartHour: number | null, notes: string, classificationLabel: string, bannedVehicleClasses: string[] | null, bannedVehicleClassesSourceUrl: string, tollDirection: TollPoint['tollDirection'], tollDirectionSourceUrl: string, tollDirectionNotes: string, pricingMode: TollPoint['pricingMode'] }>({ name: '', type: 'BRIDGE', active: true, dayStartHour: null, nightStartHour: null, notes: '', classificationLabel: '', bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: '', tollDirection: null, tollDirectionSourceUrl: '', tollDirectionNotes: '', pricingMode: 'FLAT' });
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/pricing/tolls', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...formData,
          notes: formData.notes || null,
          classificationLabel: formData.classificationLabel || null,
          bannedVehicleClassesSourceUrl: formData.bannedVehicleClasses !== null ? formData.bannedVehicleClassesSourceUrl : null,
          tollDirectionSourceUrl: formData.tollDirection !== null ? formData.tollDirectionSourceUrl : null,
          tollDirectionNotes: formData.tollDirectionNotes || null,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
       onSave(data.point);
    } catch (error: unknown) {
      alert(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nokta Adı</label>
          <input type="text" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: 15 Temmuz Şehitler Köprüsü" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçiş Tipi</label>
          <select value={formData.type} onChange={e => {
            const type = e.target.value as TollPoint['type'];
            setFormData(f => ({ ...f, type, pricingMode: closedSystemPricingMode(type) }));
          }} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
             <option value="BRIDGE">Köprü</option><option value="TUNNEL">Tünel</option><option value="HIGHWAY">Otoyol</option><option value="FERRY">Feribot</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-slate-50 rounded-lg transition-colors -ml-2">
        <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <span className="font-bold text-sm text-slate-900">Sistemde Aktif</span>
      </label>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
         <AdminActionButton label="İptal" icon={X} variant="cancel" onClick={onClose} className="flex-1" />
         <AdminActionButton
           label="Noktayı Ekle"
           icon={Plus}
           variant="new"
           onClick={handleSubmit}
            disabled={!formData.name.trim()}
           loading={loading}
           className="flex-1"
         />
      </div>
    </div>
  );
}

function TariffForm({ point, vClass, initialData, onSave, onClose }: { point: TollPoint, vClass: string, initialData?: TollTariff, onSave: () => void, onClose: () => void }) {
  const [formData, setFormData] = useState({
      timeBand: (initialData?.timeBand ?? 'ALL') as TollTimeBand,
      automaticAmountKurus: initialData?.automaticAmountKurus ?? null,
     manualAmountKurus: initialData?.manualAmountKurus ?? null,
     sourceName: initialData?.sourceName ?? '',
     sourceUrl: initialData?.sourceUrl ?? '',
     validFrom: initialData?.validFrom ? initialData.validFrom.split('T')[0] : '',
     validUntil: initialData?.validUntil ? initialData.validUntil.split('T')[0] : '',
     queriedAt: initialData?.queriedAt ? initialData.queriedAt.slice(0, 16) : '',
     active: initialData?.active ?? true,
     entryGateName: initialData?.entryGateName ?? '',
     exitGateName: initialData?.exitGateName ?? '',
     direction: (initialData?.direction ?? 'FORWARD') as 'FORWARD' | 'BACKWARD',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amount = formData.manualAmountKurus ?? formData.automaticAmountKurus ?? null;
  const isKnownOfficialSource = /(^|\.)(kgm\.gov\.tr|avrasyatuneli\.com|1915canakkale\.com|otoyolas\.com\.tr|ysskoprusuveotoyolu\.com\.tr)$/.test((() => { try { return formData.sourceUrl ? new URL(formData.sourceUrl).hostname.toLowerCase() : ''; } catch { return ''; } })());
  const needsQueryDate = amount != null && !formData.validFrom;

  const handleSubmit = async () => {
     setLoading(true);
     setError('');
     try {
       const url = initialData 
         ? `/admin/api/pricing/tolls/tariffs/${initialData.id}` 
         : `/admin/api/pricing/tolls/tariffs`;
       const method = initialData ? 'PATCH' : 'POST';
       
       const payload = {
         tollPointId: point.id,
         vehicleClass: vClass,
         timeBand: formData.timeBand,
          automaticAmountKurus: formData.automaticAmountKurus,
         manualAmountKurus: formData.manualAmountKurus,
         sourceName: formData.sourceName || null,
         sourceUrl: formData.sourceUrl || null,
         validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
         validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
         queriedAt: formData.queriedAt ? new Date(formData.queriedAt).toISOString() : null,
         active: formData.active,
         entryGateName: point.pricingMode === 'GATE_PAIR' ? (formData.entryGateName || null) : null,
         exitGateName: point.pricingMode === 'GATE_PAIR' ? (formData.exitGateName || null) : null,
         direction: point.pricingMode === 'GATE_PAIR' && point.tollDirection === 'TWO_WAY_DIRECTIONAL' ? formData.direction : null,
       };
       
       const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
       onSave();
     } catch (error: unknown) {
       setError(errorMessage(error, 'Kaydedilemedi'));
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="space-y-4">
       <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2 flex items-center justify-between">
         <div>
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Geçiş Noktası</div>
           <div className="font-bold text-slate-900 text-sm">{point.name}</div>
         </div>
         <div className="text-right">
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Araç Sınıfı</div>
           <div className="font-black text-slate-900 text-sm">{vehicleClassLabel(vClass)}</div>
         </div>
       </div>
       {error && (
         <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-xs font-bold leading-relaxed">{error}</div>
       )}
       <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-600 leading-relaxed">
         Bu satırı tutar girmeden boş bırakabilirsiniz — bu, &quot;henüz kaynak bulunamadı&quot; anlamına gelir ve fiyat motoru bu geçişi güvenle eksik veri olarak işaretler. Ancak bir TRY tutarı girerseniz, yalnızca KGM (vatandas.kgm.gov.tr dahil), Avrasya Tüneli, 1915 Çanakkale Köprüsü, OTOYOL A.Ş. veya YSS Köprüsü/Kuzey Marmara Otoyolu işletmecisi gibi resmî bir kaynak adresiyle birlikte kaydedilebilir — üçüncü taraf/karşılaştırma siteleri (ör. sigortam.net) kabul edilmez.
       </div>
       <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] font-semibold text-amber-800 leading-relaxed">
         {TOLL_VEHICLE_CLASS_SELECTION_WARNING}
       </div>

        {point.pricingMode === 'GATE_PAIR' && (
          <AdvancedSection title="Gelişmiş: giriş / çıkış gişesi ayrıntıları">
          <div className="space-y-3">
            <p className="text-xs font-bold text-purple-900">Bu nokta giriş/çıkış gişesi bazlı ücretlendiriliyor — bu tarife satırı yalnızca aşağıdaki gişe çiftine uygulanır.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Giriş Gişesi <span className="text-red-600">*</span></label>
               <input type="text" value={formData.entryGateName} onChange={e => setFormData(f => ({...f, entryGateName: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: Gebze Gişesi" />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Çıkış Gişesi <span className="text-red-600">*</span></label>
               <input type="text" value={formData.exitGateName} onChange={e => setFormData(f => ({...f, exitGateName: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: İzmir Gişesi" />
             </div>
           </div>
           {point.tollDirection === 'TWO_WAY_DIRECTIONAL' && (
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yön</label>
               <select value={formData.direction} onChange={e => setFormData(f => ({...f, direction: e.target.value as 'FORWARD' | 'BACKWARD'}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
                 <option value="FORWARD">Gidiş (Giriş → Çıkış)</option>
                 <option value="BACKWARD">Dönüş (Çıkış → Giriş, ters yönde)</option>
               </select>
               <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">Bu nokta yöne göre farklı tarifelendirildiği için gidiş ve dönüş tutarları ayrı satırlar olarak girilmelidir.</p>
             </div>
            )}
          </div>
          </AdvancedSection>
       )}

       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Zaman Dilimi</label>
         <select value={formData.timeBand} onChange={e => setFormData(f => ({...f, timeBand: e.target.value as TollTimeBand}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
            <option value="ALL">Tüm Gün (gündüz + gece aynı tarife)</option>
            <option value="DAY">Sadece Gündüz</option>
            <option value="NIGHT">Sadece Gece</option>
         </select>
         <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">
           Gündüz/gece farklı ücretlendiriliyorsa bu araç sınıfı için ayrı ayrı &quot;Sadece Gündüz&quot; ve &quot;Sadece Gece&quot; tarifeleri girin. Aynı anda &quot;Tüm Gün&quot; tarifesiyle çakışamaz.
         </p>
       </div>

        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
          <AmountInput label="Otomatik Kaynak Tutarı (TRY)" valueKurus={formData.automaticAmountKurus} onChange={v => setFormData(f => ({...f, automaticAmountKurus: v}))} />
          <p className="text-[10px] font-medium text-slate-500 mt-2 leading-relaxed">
            Yalnız doğrulanmış resmî bir kaynağa dayanan tutarı girin. Adaptörü tanımlanmamış kaynaklar için bu alan güncellenmez.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
         <AmountInput label="Manuel Fiyat (TRY) - Efektif Geçersiz Kılma" valueKurus={formData.manualAmountKurus} onChange={v => setFormData(f => ({...f, manualAmountKurus: v}))} />
         <p className="text-[10px] font-medium text-slate-500 mt-2 leading-relaxed">
           Değer girildiğinde otomatik fiyat kaynağı yoksayılır ve hesaplamalarda doğrudan bu tutar kullanılır.
         </p>
       </div>
        <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-slate-50 rounded-lg transition-colors -ml-2">
          <input type="checkbox" aria-label="Aktif" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="font-bold text-sm text-slate-900">Aktif Tarife</span>
        </label>

        <AdvancedSection title="Gelişmiş: kaynak kanıtı ve doğrulama">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak Adı (Örn: KGM)</label>
           <input type="text" value={formData.sourceName} onChange={e => setFormData(f => ({...f, sourceName: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" placeholder="Belirtilmemiş" />
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak URL (isteğe bağlı)</label>
           <input type="url" value={formData.sourceUrl} onChange={e => setFormData(f => ({...f, sourceUrl: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" placeholder="https://..." />
         </div>
       </div>

       <div className={`flex items-start gap-3 min-h-[44px] p-3 rounded-lg border ${amount == null ? 'bg-slate-50 border-slate-200' : isKnownOfficialSource ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
         <ShieldCheck size={18} className={`mt-0.5 shrink-0 ${amount == null ? 'text-slate-300' : isKnownOfficialSource ? 'text-emerald-500' : 'text-red-500'}`} />
         <div>
           <div className="font-bold text-sm text-slate-900">
             {amount == null ? 'Doğrulama gerekmiyor (henüz tutar yok)' : isKnownOfficialSource ? 'Doğrulanmış Resmî Kaynak' : 'Kaynak resmî değil'}
           </div>
           <div className="text-[10px] text-slate-600 leading-relaxed mt-1">
             {amount == null
               ? 'Bu satır tutar girilmeden kaydedilebilir; kaynak alanları boş bırakılabilir.'
               : isKnownOfficialSource
                 ? 'Bu kaynak adresi elle işaretlenmiyor — sunucu, alan adına bakarak otomatik doğruluyor.'
                 : 'Bu tutar yalnız KGM, Avrasya Tüneli veya 1915 Çanakkale Köprüsü resmî adresiyle kaydedilebilir; kaydetme reddedilecektir.'}
           </div>
         </div>
        </div>
        </AdvancedSection>

        <AdvancedSection title="Gelişmiş: geçerlilik ve sorgulama tarihleri">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçerlilik Başlangıcı</label>
           <input type="date" value={formData.validFrom} onChange={e => setFormData(f => ({...f, validFrom: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" />
           <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">Kaynak sayfada açıkça belirtilen yürürlük tarihi. Bir hesaplama aracında (ör. OTOYOL A.Ş., YSS Köprüsü/Kuzey Marmara Otoyolu) bu bilgi hiç yayımlanmaz — bu durumda boş bırakın ve sağdaki sorgulama tarihini girin.</p>
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçerlilik Bitişi</label>
           <input type="date" value={formData.validUntil} onChange={e => setFormData(f => ({...f, validUntil: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" />
         </div>
       </div>

       {amount != null && (
         <div className={`p-3 rounded-lg border ${needsQueryDate ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
             Sorgulama Tarihi {needsQueryDate && <span className="text-red-600">*</span>}
           </label>
           <input type="datetime-local" value={formData.queriedAt} onChange={e => setFormData(f => ({...f, queriedAt: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm" />
           <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">
             {needsQueryDate
               ? 'Geçerlilik başlangıcı boş bırakıldığı için zorunludur — bu tutarı bu tarihte/saatte bu kaynaktan bizzat sorguladığınızı kaydeder ve tutarın bayatlığı bu tarihe göre hesaplanır.'
               : 'Geçerlilik başlangıcı girildiği için isteğe bağlıdır.'}
           </p>
         </div>
       )}
        </AdvancedSection>

       <div className="flex gap-3 pt-5 border-t border-slate-100 mt-5">
         <AdminActionButton label="İptal" icon={X} variant="cancel" onClick={onClose} className="flex-1" />
         <AdminActionButton
           label="Tarifeyi Kaydet"
           icon={initialData ? Save : Plus}
           variant={initialData ? 'save' : 'new'}
           onClick={handleSubmit}
           loading={loading}
           className="flex-1"
         />
       </div>
    </div>
  )
}

function SyncModal({ tariff, onClose, onRefresh }: { tariff: TollTariff, onClose: () => void, onRefresh: () => void }) {
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/pricing/tolls/sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'preview', tollTariffId: tariff.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Önizleme başarısız');
      setPreview(data);
    } catch (error: unknown) {
      setError(errorMessage(error, 'Önizleme başarısız'));
    } finally {
      setLoading(false);
    }
  }, [tariff.id]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleApply = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/pricing/tolls/sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'apply', tollTariffId: tariff.id, confirmationText: confirmText, previewToken: preview?.previewToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uygulama başarısız');
      onRefresh();
      onClose();
    } catch (error: unknown) {
      setError(errorMessage(error, 'Uygulama başarısız'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 min-h-[200px]">
      {loading && !preview && !error ? (
         <div className="flex flex-col items-center justify-center py-12">
           <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
           <div className="text-sm font-bold text-slate-600">Güncel API verileri çekiliyor...</div>
         </div>
      ) : error ? (
         <div className="bg-red-50 text-red-700 p-5 rounded-xl border border-red-100 flex items-start gap-3">
           <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
           <div>
             <div className="font-bold text-sm mb-1">Eşitleme Başarısız</div>
             <div className="text-xs font-medium leading-relaxed">{error}</div>
           </div>
         </div>
      ) : preview ? (
         <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
               <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Maliyet Değişimi Önizlemesi</div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mevcut Otomatik Tutar</div>
                   <div className="text-xl font-bold text-slate-400 line-through decoration-2 decoration-slate-300">
                     {formatTRY(tariff.automaticAmountKurus)}
                   </div>
                 </div>
                 <div>
                   <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Yeni Çekilen Tutar</div>
                   <div className="text-2xl font-black text-emerald-600 tracking-tight">
                     {formatTRY(preview.newAmountKurus || preview.amountKurus)}
                   </div>
                 </div>
               </div>
            </div>
            
            {preview.requiresConfirmation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm font-medium text-blue-900 leading-relaxed mb-4">
                  Bu tarife değişikliğini onaylamak ve sistemdeki otomatik değeri güncellemek için aşağıdaki alana <strong className="font-black bg-blue-100 px-2 py-0.5 rounded">TARİFEYİ UYGULA</strong> yazın.
                </p>
                <input 
                  type="text" 
                  className="w-full min-h-[44px] bg-white border border-blue-300 rounded-lg px-4 py-2 text-sm font-bold uppercase focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" 
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="TARİFEYİ UYGULA"
                />
              </div>
            )}
            
             <div className="flex gap-3 pt-2">
               <AdminActionButton label="İptal" icon={X} variant="cancel" onClick={onClose} className="flex-1" />
               <AdminActionButton
                 label="Uygula"
                 icon={Check}
                 variant="save"
                 onClick={handleApply}
                 disabled={!preview.previewToken || (preview.requiresConfirmation && confirmText !== 'TARİFEYİ UYGULA')}
                 loading={loading}
                 className="flex-1"
               />
             </div>
         </div>
      ) : null}
    </div>
  );
}

function AlternativeForm({
  routeId,
  routes,
  points,
  tariffs,
  initialData,
  inline = false,
  onSave,
  onClose,
}: {
  routeId: string;
  routes: Route[];
  points: TollPoint[];
  tariffs: TollTariff[];
  initialData?: TollAlternative;
  inline?: boolean;
  onSave: (alternative: TollAlternative) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
     name: initialData?.name ?? '',
     active: initialData?.active ?? true,
     isDefault: initialData?.isDefault ?? false,
     displayOrder: initialData?.displayOrder ?? 0,
     pointIds: initialData?.pointIds ?? [],
     gatePairs: (initialData?.gatePairs ?? {}) as Record<string, { entryGateName: string, exitGateName: string }>,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestInFlightRef = useRef(false);
  const routeName = routes.find(r => r.id === routeId)?.name || 'Bilinmeyen Rota';
  const initialComparable = JSON.stringify({
    name: initialData?.name ?? '',
    active: initialData?.active ?? true,
    isDefault: initialData?.isDefault ?? false,
    displayOrder: initialData?.displayOrder ?? 0,
    pointIds: initialData?.pointIds ?? [],
    gatePairs: initialData?.gatePairs ?? {},
  });
  const isDirty = JSON.stringify(formData) !== initialComparable;
  const orderedFormPoints = [
    ...formData.pointIds.map(id => points.find(point => point.id === id)).filter((point): point is TollPoint => !!point),
    ...points.filter(point => !formData.pointIds.includes(point.id)),
  ];

  const togglePoint = (pid: string) => {
    setFormData(f => ({
      ...f, 
      pointIds: f.pointIds.includes(pid) ? f.pointIds.filter(id => id !== pid) : [...f.pointIds, pid]
    }));
  };

  const movePoint = (pid: string, direction: 'up' | 'down') => {
    setFormData(current => {
      const index = current.pointIds.indexOf(pid);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.pointIds.length) return current;
      const pointIds = [...current.pointIds];
      [pointIds[index], pointIds[nextIndex]] = [pointIds[nextIndex], pointIds[index]];
      return { ...current, pointIds };
    });
  };

  const handleSubmit = async () => {
    if (requestInFlightRef.current || (initialData && !isDirty)) return;
    const invalidGatePair = formData.pointIds.some((pid) => {
      const point = points.find(p => p.id === pid);
      if (point?.pricingMode !== 'GATE_PAIR') return false;
      const pair = formData.gatePairs[pid];
      const pairs = availableGatePairs(pid, tariffs);
      return pairs.length === 0 || !isExactGatePair(pair, pairs);
    });
    if (invalidGatePair) {
      setError(GATE_PAIR_MISSING_WARNING);
      return;
    }
    requestInFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const url = initialData 
        ? `/admin/api/pricing/tolls/alternatives/${initialData.id}` 
        : `/admin/api/pricing/tolls/alternatives`;
      const method = initialData ? 'PATCH' : 'POST';

      // Only send gate pairs for points that are (a) selected and (b)
      // actually GATE_PAIR-priced — a stray entry for a FLAT point would be
      // silently ignored server-side, but keep the payload clean anyway.
      const gatePairs: Record<string, { entryGateName: string, exitGateName: string }> = {};
      for (const pid of formData.pointIds) {
        const point = points.find(p => p.id === pid);
        const pair = formData.gatePairs[pid];
        if (point?.pricingMode === 'GATE_PAIR' && pair?.entryGateName?.trim() && pair?.exitGateName?.trim()) {
          gatePairs[pid] = { entryGateName: pair.entryGateName.trim(), exitGateName: pair.exitGateName.trim() };
        }
      }

      const payload = {
         routeId,
         name: formData.name,
         active: formData.active,
         isDefault: formData.isDefault,
         displayOrder: formData.displayOrder,
         pointIds: formData.pointIds,
         gatePairs,
          needsReview: initialData?.needsReview ?? false,
          reviewNote: initialData?.reviewNote ?? null,
      };

      const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
       onSave(data.alternative);
    } catch (error: unknown) {
       setError(errorMessage(error, 'Kaydedilemedi'));
    } finally {
       requestInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {!inline && <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-2">
         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Bağlı Rota</div>
         <div className="font-bold text-slate-900 text-sm">{routeName}</div>
       </div>}

       {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
       
       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alternatif Adı</label>
         <input type="text" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: 1. Köprü Üzerinden" />
       </div>

       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kapsanan Geçiş Noktaları</label>
         <div className="border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto divide-y divide-slate-100 bg-white">
             {orderedFormPoints.map(p => {
               const selectedIndex = formData.pointIds.indexOf(p.id);
               const selected = selectedIndex >= 0;
               return (
              <div key={p.id} className="p-3 hover:bg-slate-50 transition-colors">
                 <div className="flex min-w-0 items-start gap-2">
                   <label className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={selected} disabled={!p.active && !selected} onChange={() => togglePoint(p.id)} className="w-5 h-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50" />
                    <div className="min-w-0">
                     <div className="font-bold text-sm text-slate-900 leading-none">{p.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.type}{p.pricingMode === 'GATE_PAIR' ? ' • GİŞE BAZLI' : ''}{!p.active ? ' • PASİF' : ''}</div>
                   </div>
                   </label>
                   {selected && (
                     <div className="flex shrink-0 gap-1">
                        <AdminRecordActions
                          up={{ onClick: () => movePoint(p.id, 'up'), disabled: selectedIndex === 0 }}
                          down={{ onClick: () => movePoint(p.id, 'down'), disabled: selectedIndex === formData.pointIds.length - 1 }}
                        />
                     </div>
                   )}
                 </div>
                 {selected && p.pricingMode === 'GATE_PAIR' && (
                   (() => {
                     const pairs = availableGatePairs(p.id, tariffs);
                     const current = formData.gatePairs[p.id];
                     const currentKey = current ? gatePairKey(current.entryGateName, current.exitGateName) : '';
                     const exactCurrent = pairs.some(pair => gatePairKey(pair.entryGateName, pair.exitGateName) === currentKey);
                     return (
                       <div className="mt-2 ml-8 space-y-2">
                         {pairs.length > 0 ? (
                           <select
                             aria-label={`${p.name} gişe çifti`}
                             value={exactCurrent ? currentKey : current ? '__invalid__' : ''}
                             onChange={e => {
                               const pair = pairs.find(candidate => gatePairKey(candidate.entryGateName, candidate.exitGateName) === e.target.value);
                               if (pair) setFormData(f => ({ ...f, gatePairs: { ...f.gatePairs, [p.id]: pair } }));
                             }}
                             className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                           >
                             <option value="">Gişe çifti seçin</option>
                             {!exactCurrent && current && (
                               <option value="__invalid__" disabled>{current.entryGateName} → {current.exitGateName} · Eşleştirme gerekli</option>
                             )}
                             {pairs.map(pair => (
                               <option key={gatePairKey(pair.entryGateName, pair.exitGateName)} value={gatePairKey(pair.entryGateName, pair.exitGateName)}>
                                 {pair.entryGateName} → {pair.exitGateName}
                               </option>
                             ))}
                           </select>
                         ) : (
                           <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{GATE_PAIR_MISSING_WARNING}</p>
                         )}
                         {!exactCurrent && current && (
                           <p role="alert" className="text-xs font-bold text-amber-700">Eşleştirme gerekli</p>
                         )}
                         <p className="text-[10px] font-medium text-slate-500">Bu nokta gişe bazlı ücretlendiriliyor; yalnızca aktif tarife satırlarında bulunan gişe çiftleri seçilebilir.</p>
                       </div>
                     );
                   })()
                )}
              </div>
             )})}
            {points.length === 0 && <div className="p-6 text-center text-sm text-slate-500 font-medium">Sistemde hiç geçiş noktası bulunamadı.</div>}
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Görüntülenme Sırası</label>
            <input type="number" min="0" value={formData.displayOrder} onChange={e => setFormData(f => ({...f, displayOrder: parseInt(e.target.value)||0}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" />
          </div>
       </div>

       <div className="flex flex-col gap-1 p-3 bg-slate-50 border border-slate-200 rounded-xl">
         <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-white rounded-lg transition-colors">
           <input type="radio" checked={formData.isDefault} onChange={() => setFormData(f => ({...f, isDefault: true}))} className="w-5 h-5 border-slate-300 text-blue-600 focus:ring-blue-500" />
           <div>
             <div className="font-bold text-sm text-slate-900">Öncelikli (Varsayılan) Alternatif</div>
             <div className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Bu rota hesaplanırken fiyatlandırmada kullanılacak varsayılan geçiş.</div>
           </div>
         </label>
         <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-white rounded-lg transition-colors">
           <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
           <span className="font-bold text-sm text-slate-900">Seçime Açık (Aktif)</span>
         </label>
       </div>

        <div className="flex gap-3 pt-3 border-t border-slate-100">
          <AdminActionButton label={inline ? 'Vazgeç' : 'İptal'} icon={X} variant="cancel" onClick={onClose} className="flex-1" />
          <AdminActionButton
            label="Kaydet"
            icon={initialData ? Save : Plus}
            variant={initialData ? 'save' : 'new'}
            onClick={handleSubmit}
            disabled={!formData.name.trim() || (!!initialData && !isDirty)}
            loading={loading}
            className="flex-1"
          />
        </div>
    </div>
  )
}


type QuickTariffClassRequest = {
  pointId: string;
  vehicleClass: string;
  nonce: number;
};

function QuickTariffAdd({
  point,
  vehicleClasses,
  onRefresh,
  classRequest,
}: {
  point: TollPoint;
  vehicleClasses: string[];
  onRefresh: () => Promise<void>;
  classRequest: QuickTariffClassRequest | null;
}) {
  const [entryGateName, setEntryGateName] = useState('');
  const [exitGateName, setExitGateName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [vehicleClass, setVehicleClass] = useState(vehicleClasses[0] || 'class_1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  const requestInFlightRef = useRef(false);

  const handleClassChange = (newVc: string) => {
    setVehicleClass(newVc);
    setAmountStr('');
    setFieldErrors({});
    setError('');
    setMessage('');
  };

  useEffect(() => {
    if (!classRequest || classRequest.pointId !== point.id) return;
    handleClassChange(classRequest.vehicleClass);
    amountInputRef.current?.focus();
  }, [classRequest, point.id]);

  const handleAdd = async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const requiredErrors: Record<string, string> = {};
    if (!entryGateName.trim()) requiredErrors.entryGateName = 'Giriş gişesi zorunludur.';
    if (!exitGateName.trim()) requiredErrors.exitGateName = 'Çıkış gişesi zorunludur.';
    if (!amountStr.trim()) requiredErrors.amount = 'Ücret zorunludur.';
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      requestInFlightRef.current = false;
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    let responseHasFieldErrors = false;
    try {
      const res = await fetch('/admin/api/pricing/tolls/tariffs/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tollPointId: point.id,
          entryGateName,
          exitGateName,
          amount: amountStr,
          vehicleClass,
          timeBand: 'ALL',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) {
          responseHasFieldErrors = true;
          setFieldErrors(json.fieldErrors);
        }
        throw new Error(json.error || 'Tarife eklenemedi.');
      }

      try {
        await onRefresh();
      } catch {
        throw new Error('Tarife kaydedildi ancak liste yenilenemedi. Girdiğiniz değerler korundu; sayfayı yenileyin.');
      }
      setMessage('Tarife başarıyla kaydedildi.');
      setAmountStr('');

      setTimeout(() => setMessage(''), 3000);
    } catch (e: unknown) {
      if (!responseHasFieldErrors) setError(errorMessage(e, 'Tarife eklenemedi.'));
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="mx-5 md:mx-6 mt-5 mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5 shadow-sm">
      <div className="mb-4">
        <h4 className="font-black text-base text-blue-950">Hızlı Tarife Ekle</h4>
        <p className="text-xs text-blue-900/80 mt-1 leading-relaxed">Değerleri girip doğrudan yeni bir onaylanmış tarife satırı oluşturun. Rota haritası olmadan anında kayıt.</p>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${(point.pricingMode === 'GATE_PAIR' || point.type === 'FERRY') ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-3 items-start`}>
        {(point.pricingMode === 'GATE_PAIR' || point.type === 'FERRY') && (
          <>
            <div>
              <label htmlFor="quick-tariff-entry-gate" className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">Giriş Gişesi</label>
              <input
                id="quick-tariff-entry-gate"
                data-testid="quick-tariff-entry-gate"
                type="text"
                value={entryGateName}
                onChange={e => { setEntryGateName(e.target.value); setFieldErrors(f => ({ ...f, entryGateName: '' })); }}
                placeholder="Örn. Işıktepe"
                className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 shadow-sm transition-all ${fieldErrors.entryGateName ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-blue-200 focus:border-blue-500 focus:ring-blue-500'}`}
              />
              {fieldErrors.entryGateName && <div className="text-[10px] text-red-600 mt-1 font-bold">{fieldErrors.entryGateName}</div>}
            </div>

            <div>
              <label htmlFor="quick-tariff-exit-gate" className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">Çıkış Gişesi</label>
              <input
                id="quick-tariff-exit-gate"
                data-testid="quick-tariff-exit-gate"
                type="text"
                value={exitGateName}
                onChange={e => { setExitGateName(e.target.value); setFieldErrors(f => ({ ...f, exitGateName: '' })); }}
                placeholder="Örn. Kestel"
                className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 shadow-sm transition-all ${fieldErrors.exitGateName ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-blue-200 focus:border-blue-500 focus:ring-blue-500'}`}
              />
              {fieldErrors.exitGateName && <div className="text-[10px] text-red-600 mt-1 font-bold">{fieldErrors.exitGateName}</div>}
            </div>
          </>
        )}

        <div>
          <label htmlFor="quick-tariff-amount" className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">Ücret (TRY)</label>
          <input
            ref={amountInputRef}
            id="quick-tariff-amount"
            data-testid="quick-tariff-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={e => { setAmountStr(e.target.value); setFieldErrors(f => ({...f, amount: ''})); }}
            placeholder="0.00"
            className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 shadow-sm transition-all ${fieldErrors.amount ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-blue-200 focus:border-blue-500 focus:ring-blue-500'}`}
          />
          {fieldErrors.amount && <div className="text-[10px] text-red-600 mt-1 font-bold">{fieldErrors.amount}</div>}
        </div>

        <div>
          <label htmlFor="quick-tariff-class" className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">Araç Sınıfı</label>
          <select
            id="quick-tariff-class"
            data-testid="quick-tariff-class"
            value={vehicleClass}
            onChange={e => handleClassChange(e.target.value)}
            className={`w-full min-h-[44px] rounded-lg border bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 shadow-sm transition-all ${fieldErrors.vehicleClass ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-blue-200 focus:border-blue-500 focus:ring-blue-500'}`}
          >
            {vehicleClasses.map(vc => (
              <option key={vc} value={vc}>{vehicleClassLabel(vc)}</option>
            ))}
          </select>
          {fieldErrors.vehicleClass && <div className="text-[10px] text-red-600 mt-1 font-bold">{fieldErrors.vehicleClass}</div>}
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:pt-[22px]">
          <AdminActionButton
            label={busy ? 'Kaydediliyor...' : 'Kaydet'}
            icon={Plus}
            variant="new"
            onClick={handleAdd}
            loading={busy}
            testId="quick-tariff-add"
            className="w-full"
          />
        </div>
      </div>

      {(error || message || fieldErrors._general) && (
        <div className="mt-4 text-sm font-bold">
          {error && <div className="text-red-700 bg-red-50 p-2 rounded-md border border-red-100">{error}</div>}
          {fieldErrors._general && <div className="text-red-700 bg-red-50 p-2 rounded-md border border-red-100">{fieldErrors._general}</div>}
          {message && <div className="text-emerald-700 bg-emerald-50 p-2 rounded-md border border-emerald-100">{message}</div>}
        </div>
      )}
    </div>
  );
}


function InlineTariffEditor({
  point,
  tariff,
  onCancel,
  onUpdated,
}: {
  point: TollPoint;
  tariff: TollTariff;
  onCancel: () => void;
  onUpdated: (tariff: TollTariff) => void;
}) {
  const originalEntry = tariff.entryGateName?.trim() ?? '';
  const originalExit = tariff.exitGateName?.trim() ?? '';
  const originalAmount = tariff.amountKurus;
  const [entryGateName, setEntryGateName] = useState(originalEntry);
  const [exitGateName, setExitGateName] = useState(originalExit);
  const [amount, setAmount] = useState(formatTRYInput(originalAmount));
  const [timeBand] = useState<TollTimeBand>(point.type === 'FERRY' ? 'ALL' : tariff.timeBand);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestInFlightRef = useRef(false);
  const parsedAmount = parseTRYInput(amount);
  const gatePair = point.pricingMode === 'GATE_PAIR' || point.type === 'FERRY';
  const entryValid = !gatePair || entryGateName.trim().length > 0;
  const exitValid = !gatePair || exitGateName.trim().length > 0;
  const amountValid = parsedAmount !== null;
  const dirty =
    (gatePair && entryGateName.trim() !== originalEntry) ||
    (gatePair && exitGateName.trim() !== originalExit) ||
    parsedAmount !== originalAmount ||
    (point.type === 'FERRY' ? tariff.timeBand !== 'ALL' : timeBand !== tariff.timeBand);
  const canSave = dirty && entryValid && exitValid && amountValid && !busy;

  const save = async () => {
    if (!canSave || requestInFlightRef.current || parsedAmount === null) return;
    requestInFlightRef.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/admin/api/pricing/tolls/tariffs/${tariff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tollPointId: tariff.tollPointId,
          vehicleClass: tariff.vehicleClass,
          timeBand: point.type === 'FERRY' ? 'ALL' : timeBand,
          automaticAmountKurus: tariff.automaticAmountKurus,
          manualAmountKurus: parsedAmount,
          sourceName: tariff.sourceName,
          sourceUrl: tariff.sourceUrl,
          validFrom: tariff.validFrom,
          validUntil: tariff.validUntil,
          queriedAt: tariff.queriedAt ?? null,
          active: tariff.active,
          entryGateName: gatePair ? entryGateName.trim() : null,
          exitGateName: gatePair ? exitGateName.trim() : null,
          direction: tariff.direction ?? null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.tariff) {
        throw new Error(result?.error ?? 'Tarife güncellenemedi.');
      }
      onUpdated(result.tariff as TollTariff);
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, 'Tarife güncellenemedi. Değerleriniz korunuyor.'));
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
    }
  };

  const inputClass = 'w-full min-h-[44px] rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50/60 p-3" data-testid={`tariff-row-${tariff.vehicleClass}`} data-tariff-id={tariff.id}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(110px,0.7fr)_auto] xl:items-start">
        <div className="min-w-0">
          <label htmlFor={`tariff-entry-${tariff.id}`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-blue-900">Giriş Gişesi</label>
          {gatePair ? (
            <>
              <input id={`tariff-entry-${tariff.id}`} data-testid="inline-tariff-entry" value={entryGateName} onChange={(event) => setEntryGateName(event.target.value)} aria-invalid={!entryValid} className={`${inputClass} ${!entryValid ? 'border-red-400' : ''}`} />
              {!entryValid && <p className="mt-1 text-[10px] font-bold text-red-700">Giriş gişesi zorunludur.</p>}
            </>
          ) : (
            <div className="flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-500">—</div>
          )}
        </div>
        <div className="min-w-0">
          <label htmlFor={`tariff-exit-${tariff.id}`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-blue-900">Çıkış Gişesi</label>
          {gatePair ? (
            <>
              <input id={`tariff-exit-${tariff.id}`} data-testid="inline-tariff-exit" value={exitGateName} onChange={(event) => setExitGateName(event.target.value)} aria-invalid={!exitValid} className={`${inputClass} ${!exitValid ? 'border-red-400' : ''}`} />
              {!exitValid && <p className="mt-1 text-[10px] font-bold text-red-700">Çıkış gişesi zorunludur.</p>}
            </>
          ) : (
            <div className="flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-500">—</div>
          )}
        </div>
        <div className="min-w-0">
          <label htmlFor={`tariff-amount-${tariff.id}`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-blue-900">Fiyat (TRY)</label>
          <input id={`tariff-amount-${tariff.id}`} data-testid="inline-tariff-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={!amountValid} className={`${inputClass} ${!amountValid ? 'border-red-400' : ''}`} />
          {!amountValid && <p className="mt-1 text-[10px] font-bold text-red-700">Geçerli, negatif olmayan bir TL tutarı girin.</p>}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-1 xl:pt-[22px]">
          <AdminActionButton
            label="Vazgeç"
            icon={X}
            variant="cancel"
            onClick={onCancel}
            disabled={busy}
            testId="inline-tariff-cancel"
          />
          <AdminActionButton
            label={busy ? 'Kaydediliyor...' : 'Kaydet'}
            icon={Save}
            variant="save"
            onClick={save}
            disabled={!canSave}
            loading={busy}
            testId="inline-tariff-save"
          />
        </div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>}
    </div>
  );
}

function PointDetail({ point, tariffs, vehicleClasses, onRefresh, onDelete, deleting, onAddTariff, onTariffUpdated, onSync }: { point: TollPoint, tariffs: TollTariff[], vehicleClasses: string[], onRefresh: () => Promise<void>, onDelete: () => void, deleting: boolean, onAddTariff: (vc: string) => void, onTariffUpdated: (tariff: TollTariff) => void, onSync: (t: TollTariff) => void }) {
  const [quickTariffClassRequest, setQuickTariffClassRequest] = useState<QuickTariffClassRequest | null>(null);
  const [tariffActionError, setTariffActionError] = useState('');
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);

  useEffect(() => {
    setEditingTariffId(null);
    setTariffActionError('');
  }, [point.id]);

  const prepareQuickTariffClass = (vehicleClass: string) => {
    setQuickTariffClassRequest({
      pointId: point.id,
      vehicleClass,
      nonce: Date.now(),
    });
  };

  const patchTariffActive = async (tariff: TollTariff, active: boolean) => {
    setTariffActionError('');
    const response = await fetch(`/admin/api/pricing/tolls/tariffs/${tariff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tollPointId: tariff.tollPointId,
        vehicleClass: tariff.vehicleClass,
        timeBand: tariff.timeBand,
        automaticAmountKurus: tariff.automaticAmountKurus,
        manualAmountKurus: tariff.manualAmountKurus,
        sourceName: tariff.sourceName,
        sourceUrl: tariff.sourceUrl,
        validFrom: tariff.validFrom,
        validUntil: tariff.validUntil,
        queriedAt: tariff.queriedAt ?? null,
        active,
        entryGateName: tariff.entryGateName ?? null,
        exitGateName: tariff.exitGateName ?? null,
        direction: tariff.direction ?? null,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? 'Tarife durumu güncellenemedi.');
    await onRefresh();
  };

  const deleteTariff = async (tariff: TollTariff) => {
    if (!window.confirm(`“${vehicleClassLabel(tariff.vehicleClass)}” tarifesi kalıcı olarak silinecek. Bu işlemi açıkça onaylıyor musunuz?`)) return;
    setTariffActionError('');
    const response = await fetch(`/admin/api/pricing/tolls/tariffs/${tariff.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? 'Tarife silinemedi.');
    await onRefresh();
  };

  const runTariffAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error: unknown) {
      setTariffActionError(errorMessage(error, 'Tarife işlemi tamamlanamadı.'));
    }
  };

  const [formData, setFormData] = useState({
    name: point.name,
    type: point.type,
    active: point.active,
    dayStartHour: point.dayStartHour,
    nightStartHour: point.nightStartHour,
    notes: point.notes ?? '',
    classificationLabel: point.classificationLabel ?? '',
    bannedVehicleClasses: point.bannedVehicleClasses,
    bannedVehicleClassesSourceUrl: point.bannedVehicleClassesSourceUrl ?? '',
    tollDirection: point.tollDirection,
    tollDirectionSourceUrl: point.tollDirectionSourceUrl ?? '',
    tollDirectionNotes: point.tollDirectionNotes ?? '',
    pricingMode: point.pricingMode,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setFormData({
      name: point.name, type: point.type, active: point.active, dayStartHour: point.dayStartHour, nightStartHour: point.nightStartHour, notes: point.notes ?? '',
      classificationLabel: point.classificationLabel ?? '', bannedVehicleClasses: point.bannedVehicleClasses, bannedVehicleClassesSourceUrl: point.bannedVehicleClassesSourceUrl ?? '',
      tollDirection: point.tollDirection, tollDirectionSourceUrl: point.tollDirectionSourceUrl ?? '', tollDirectionNotes: point.tollDirectionNotes ?? '', pricingMode: point.pricingMode,
    });
    setSaved(false);
  }, [point]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/admin/api/pricing/tolls/${point.id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...formData,
          notes: formData.notes || null,
          classificationLabel: formData.classificationLabel || null,
          bannedVehicleClassesSourceUrl: formData.bannedVehicleClasses !== null ? formData.bannedVehicleClassesSourceUrl : null,
          tollDirectionSourceUrl: formData.tollDirection !== null ? formData.tollDirectionSourceUrl : null,
          tollDirectionNotes: formData.tollDirectionNotes || null,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      setSaved(true);
      await onRefresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) {
      alert(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {(point.tollDirection == null || point.bannedVehicleClasses == null) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Doğrulanmamış ilave ücret — {point.name} için kaynak veya yön bilgisi henüz teyit edilmemiş olabilir.
          Admin bu veriyi yönetebilir; bu uyarı müşteriye gösterilmez.
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5">
            <MapPin className="text-blue-600" size={22} /> Nokta Tanımı
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded">ID: {point.id.slice(0,8)}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
           <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nokta Adı</label>
             <input type="text" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" />
           </div>
           <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçiş Tipi</label>
               <select value={formData.type} onChange={e => {
                 const type = e.target.value as TollPoint['type'];
                 setFormData(f => ({ ...f, type, pricingMode: closedSystemPricingMode(type) }));
               }} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
                <option value="BRIDGE">Köprü (Bridge)</option>
                <option value="TUNNEL">Tünel (Tunnel)</option>
                <option value="HIGHWAY">Otoyol (Highway)</option>
                 <option value="FERRY">Feribot (Ferry)</option>
             </select>
           </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer min-h-[44px] hover:bg-slate-50 p-2 -ml-2 mb-5 rounded-lg transition-colors">
          <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="font-bold text-sm text-slate-900">Sistemde Kullanılabilir (Aktif)</span>
        </label>

        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 min-[480px]:justify-end min-[480px]:[grid-template-columns:auto_auto] mt-5">
           <AdminActionButton
             label={saved ? 'Değişiklikler Kaydedildi' : 'Değişiklikleri Kaydet'}
             icon={saved ? Check : Save}
             variant="save"
             onClick={handleSave}
              disabled={loading || deleting}
             loading={loading}
             className="w-full min-[480px]:w-auto"
           />
           <AdminActionButton
             label={deleting ? 'Siliniyor...' : 'Sil'}
             icon={Trash2}
             variant="delete"
             onClick={onDelete}
             disabled={loading || deleting}
             loading={deleting}
             ariaLabel={`${point.name} geçiş noktasını sil`}
             testId="delete-toll-point"
             className="w-full min-[480px]:w-auto"
           />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5">
            <Car className="text-slate-600" size={22} /> Araç Sınıfı Tarifeleri
          </h3>
        </div>

        {(point.pricingMode === 'GATE_PAIR' || point.type === 'FERRY') && (
          <QuickTariffAdd
            key={point.id}
            point={point}
            vehicleClasses={vehicleClasses}
            onRefresh={onRefresh}
            classRequest={quickTariffClassRequest}
          />
        )}
        <BulkIncreaseCard point={point} onRefresh={onRefresh} />

        <div className="p-4 md:p-5 flex flex-col gap-3">
          {tariffActionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{tariffActionError}</div>}
          {vehicleClasses.map(vc => {
             const classTariffs = tariffs.filter(t => t.tollPointId === point.id && t.vehicleClass === vc)
               .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
             const activeTariffs = classTariffs.filter(t => t.active);
             const hasAll = activeTariffs.some(t => t.timeBand === 'ALL');
             const hasDay = activeTariffs.some(t => t.timeBand === 'DAY');
             const hasNight = activeTariffs.some(t => t.timeBand === 'NIGHT');
              const isCovered = point.type === 'FERRY' ? hasAll : hasAll || (hasDay && hasNight);
             const hasAnyRowAtAll = classTariffs.length > 0;

             return (
               <section
                 key={vc}
                 data-testid={`tariff-class-section-${vc}`}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-300 md:p-4"
               >
                  <div className="flex flex-col items-stretch justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                       <h4 className="text-base font-black tracking-tight text-slate-950">
                        {vehicleClassLabel(vc)} <span className="text-slate-500 font-medium ml-1">({classTariffs.length})</span>
                       </h4>
                      {!isCovered && !hasAnyRowAtAll && point.notes && <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Tarife Yok (Notu Kontrol Edin)</span>}
                      {!isCovered && (!point.notes || hasAnyRowAtAll) && <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Eksik Tarife</span>}
                    </div>
                      {point.type !== 'FERRY' && <AdminActionButton
                        label="Tarife Ekle"
                        icon={Plus}
                        variant="new"
                        onClick={() => point.pricingMode === 'GATE_PAIR' ? prepareQuickTariffClass(vc) : onAddTariff(vc)}
                        title={`${vehicleClassLabel(vc)} tarife ekle`}
                        ariaLabel={`${vehicleClassLabel(vc)} tarife ekle`}
                        testId={`prepare-quick-tariff-${vc}`}
                        className="w-full sm:w-auto"
                      />}
                  </div>

                  {classTariffs.length === 0 ? (
                    <div className="text-xs font-medium text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed">
                      <strong>Henüz tarife yok.</strong> Bu araç sınıfı için henüz aktif/geçerli tarife tanımlanmamış. Bu nokta seçili bir rota alternatifindeyse fiyat motoru teklifi güvenle durdurur; eksik veri olarak işaretlenir, asla 0 TRY varsayılmaz.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {!isCovered && point.type !== 'FERRY' && (
                        <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                          Mevcut tarifeler tüm zaman dilimlerini kapsamıyor ({hasDay ? 'gündüz var, gece eksik' : hasNight ? 'gece var, gündüz eksik' : 'hiçbir dilim tanımlı değil'}). Kapsanmayan saatlerde fiyat motoru bu geçişi eksik veri olarak işaretler.
                        </div>
                      )}
                      {classTariffs.map((tariff) => editingTariffId === tariff.id ? (
                        <InlineTariffEditor
                          key={tariff.id}
                          point={point}
                          tariff={tariff}
                          onCancel={() => setEditingTariffId(null)}
                          onUpdated={(updated) => {
                            onTariffUpdated(updated);
                            setEditingTariffId(null);
                          }}
                        />
                      ) : (
                           <div key={tariff.id} data-testid={`tariff-row-${vc}`} data-tariff-id={tariff.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(86px,auto)_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                            <div className="min-w-0">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Giriş Gişesi</span>
                              <span className="block break-words text-xs font-bold leading-snug text-slate-800 [overflow-wrap:anywhere]">{tariff.entryGateName || '—'}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Çıkış Gişesi</span>
                              <span className="block break-words text-xs font-bold leading-snug text-slate-800 [overflow-wrap:anywhere]">{tariff.exitGateName || '—'}</span>
                            </div>
                            <div className="min-w-0 text-right">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Fiyat</span>
                              <span className="flex flex-wrap items-center justify-end gap-1 whitespace-nowrap text-sm font-black tracking-tight text-blue-700">
                                {formatTRY(tariff.amountKurus)}
                              </span>
                              {!tariff.active && <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-red-700">Pasif</span>}
                            </div>
                            <div className="flex items-center justify-end">
                              {tariff.sourceVerified && isAutomaticTollSyncSupported({ sourceUrl: tariff.sourceUrl, vehicleClass: tariff.vehicleClass, timeBand: tariff.timeBand }) && (
                                 <button title="Resmî kaynaktan yeniden çek" aria-label="Tarifeyi otomatik çek" onClick={() => onSync(tariff)} className="min-h-[40px] px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm border border-slate-200/60">
                                  <RefreshCw size={14} /> Otomatik Çek
                                </button>
                              )}
                              <AdminRecordActions
                                edit={{ onClick: () => { setTariffActionError(''); setEditingTariffId(tariff.id); } }}
                                activation={{ onClick: () => runTariffAction(() => patchTariffActive(tariff, !tariff.active)), isActive: tariff.active }}
                                delete={{ onClick: () => runTariffAction(() => deleteTariff(tariff)) }}
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
               </section>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function PointsManager({ data, onRefresh, onTariffUpdated }: { data: DataPayload, onRefresh: () => Promise<void>, onTariffUpdated: (tariff: TollTariff) => void }) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [orderedPoints, setOrderedPoints] = useState(data.points);
  const [newPointModal, setNewPointModal] = useState(false);
  const [newTariffModal, setNewTariffModal] = useState<{vc: string} | null>(null);
  const [syncModalTariff, setSyncModalTariff] = useState<TollTariff | null>(null);
  const [reorderBusyId, setReorderBusyId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState('');
  const [pointActionMessage, setPointActionMessage] = useState('');
  const [pointActionError, setPointActionError] = useState('');
  const [deletingPointId, setDeletingPointId] = useState<string | null>(null);
  const reorderInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

  const selectedPoint = data.points.find(p => p.id === selectedPointId) || null;
  useEffect(() => { setOrderedPoints(data.points); }, [data.points]);
  const reorderPoint = async (id: string, direction: 'up' | 'down') => {
    if (reorderInFlightRef.current) return;
    reorderInFlightRef.current = true;
    setReorderBusyId(id);
    setReorderError('');
    try {
      const response = await fetch('/admin/api/pricing/tolls/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, direction }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Sıralama güncellenemedi.');
      // Mutation responses are deliberately not treated as list snapshots.
      // Reload the complete canonical payload, guarded by the page's latest-
      // request-wins loader, so selection and detail stay on the same ID.
      await onRefresh();
    } catch (error: unknown) {
      setReorderError(errorMessage(error, 'Sıralama güncellenemedi. Mevcut liste korundu.'));
    } finally {
      reorderInFlightRef.current = false;
      setReorderBusyId(null);
    }
  };

  const deleteSelectedPoint = async () => {
    if (!selectedPoint || deleteInFlightRef.current) return;
    if (!window.confirm(`“${selectedPoint.name}” geçiş noktası kalıcı olarak silinecek. Bu işlemi açıkça onaylıyor musunuz?`)) return;

    const currentIndex = orderedPoints.findIndex((item) => item.id === selectedPoint.id);
    const fallbackPointId = orderedPoints[currentIndex + 1]?.id ?? orderedPoints[currentIndex - 1]?.id ?? null;
    deleteInFlightRef.current = true;
    setDeletingPointId(selectedPoint.id);
    setPointActionError('');
    setPointActionMessage('');
    try {
      const response = await fetch(`/admin/api/pricing/tolls/${selectedPoint.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Geçiş noktası silinemedi.');
      await onRefresh();
      setSelectedPointId(fallbackPointId);
      setPointActionMessage(`“${selectedPoint.name}” geçiş noktası başarıyla silindi.`);
    } catch (error: unknown) {
      setPointActionError(errorMessage(error, 'Geçiş noktası silinemedi. Hiçbir bağlı kayıt değiştirilmedi.'));
    } finally {
      deleteInFlightRef.current = false;
      setDeletingPointId(null);
    }
  };

  return (
    <div>
      {(pointActionMessage || pointActionError) && (
        <div
          role={pointActionError ? 'alert' : 'status'}
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-bold ${pointActionError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {pointActionError || pointActionMessage}
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-[38%] xl:w-[36%] flex flex-col gap-3">
        <AdminActionButton
          label="Yeni Geçiş Noktası"
          icon={Plus}
          variant="new"
          onClick={() => setNewPointModal(true)}
          className="w-full rounded-xl"
        />
        {reorderError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{reorderError}</div>}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 pb-4">
          {orderedPoints.length === 0 ? (
             <div className="text-center p-6 text-sm font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
               Sistemde henüz geçiş noktası yok.
             </div>
          ) : orderedPoints.map((p, index) => (
             <div key={p.id} className={`grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 p-2 min-h-[72px] rounded-xl border transition-all duration-200 ${selectedPoint?.id === p.id ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
               <button onClick={() => setSelectedPointId(p.id)} className="text-left w-full min-h-[56px] min-w-0 p-2 rounded-lg hover:bg-slate-50">
                <div className={`font-black text-sm mb-1.5 break-words leading-snug [overflow-wrap:anywhere] ${selectedPoint?.id === p.id ? 'text-blue-900' : 'text-slate-900'}`}>{p.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.type}</span>
                   {!p.active && <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-widest">Pasif</span>}
                   {p.bannedVehicleClasses && p.bannedVehicleClasses.length > 0 && <span className="text-[9px] font-black text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-widest">Araç Yasağı</span>}
                   {p.bannedVehicleClasses === null && <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest">Yasak Belirsiz</span>}
                </div>
               </button>
               <div className="flex shrink-0 items-center justify-end pt-1">
                 <AdminRecordActions
                    up={{ onClick: () => reorderPoint(p.id, 'up'), disabled: index === 0 || reorderBusyId !== null }}
                    down={{ onClick: () => reorderPoint(p.id, 'down'), disabled: index === orderedPoints.length - 1 || reorderBusyId !== null }}
                 />
               </div>
             </div>
          ))}
        </div>
      </div>
      
      <div className="w-full min-w-0 lg:w-[62%] xl:w-[64%]">
         {selectedPoint ? (
           <div className="animate-in fade-in slide-in-from-right-2 duration-300">
             <PointDetail 
               point={selectedPoint} 
               tariffs={data.tariffs} 
               vehicleClasses={data.vehicleClasses} 
               onRefresh={onRefresh}
              onDelete={deleteSelectedPoint}
              deleting={deletingPointId === selectedPoint.id}
                onAddTariff={(vc) => setNewTariffModal({vc})}
                onTariffUpdated={onTariffUpdated}
               onSync={(t) => setSyncModalTariff(t)}
             />
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-200 border-dashed rounded-2xl bg-slate-50/50 min-h-[400px]">
             <MapPin size={48} className="text-slate-300 mb-4" />
             <h4 className="text-lg font-black text-slate-700 mb-2">Nokta Detayları</h4>
             <p className="text-sm font-medium text-slate-500 max-w-sm">Görüntülemek veya düzenlemek için sol taraftaki listeden bir geçiş noktası seçin.</p>
           </div>
         )}
      </div>
      </div>

      {newPointModal && (
        <Modal title="Yeni Geçiş Noktası Ekle" onClose={() => setNewPointModal(false)}>
           <PointForm onSave={(p) => { setNewPointModal(false); onRefresh(); setSelectedPointId(p.id); }} onClose={() => setNewPointModal(false)} />
        </Modal>
      )}

      {newTariffModal && selectedPoint && selectedPoint.type !== 'FERRY' && (
        <Modal title={`${selectedPoint.name} — ${vehicleClassLabel(newTariffModal.vc)} Tarifesi`} onClose={() => setNewTariffModal(null)}>
           <TariffForm 
             point={selectedPoint} 
              vClass={newTariffModal.vc}
              onSave={() => { setNewTariffModal(null); onRefresh(); }}
              onClose={() => setNewTariffModal(null)}
           />
        </Modal>
      )}

      {syncModalTariff && (
        <Modal title="Tarife Kaynağını Senkronize Et" onClose={() => setSyncModalTariff(null)}>
           <SyncModal tariff={syncModalTariff} onClose={() => setSyncModalTariff(null)} onRefresh={onRefresh} />
        </Modal>
      )}
    </div>
  );
}

// One alternative's live comparison figure for a chosen vehicle, returned by
// GET .../route-alternatives/[routeId]?vehicleId=...
type AlternativeComparison = {
  id: string;
  totalKurus: number | null;
  missingTariffPointNames?: string[];
  bannedPointNames?: string[];
  needsReview?: boolean;
  reviewNote?: string | null;
};

function AlternativesManager({ data, onRefresh }: { data: DataPayload, onRefresh: () => Promise<void> }) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [newAltModal, setNewAltModal] = useState<{ routeId: string } | null>(null);
  const [editingAlternativeId, setEditingAlternativeId] = useState<string | null>(null);
  const [deletingAlternativeId, setDeletingAlternativeId] = useState<string | null>(null);
  const deleteRequestInFlightRef = useRef(false);
  const [compareVehicles, setCompareVehicles] = useState<{ id: string, name: string }[]>([]);
  const [compareVehicleId, setCompareVehicleId] = useState<string>('');
  const [comparison, setComparison] = useState<Record<string, AlternativeComparison>>({});
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Vehicle list isn't part of DataPayload (this page is about toll points,
  // not the fleet) — fetch it once from the pricing-profiles endpoint, which
  // already exposes { id, name } for every vehicle.
  useEffect(() => {
    fetch('/admin/api/pricing/profiles')
      .then(res => res.ok ? res.json() : null)
      .then(json => { if (json?.vehicles) setCompareVehicles(json.vehicles.map((v: { id: string, name: string }) => ({ id: v.id, name: v.name }))); })
      .catch(() => {});
  }, []);

  const routeAlts = data.alternatives.filter(a => a.routeId === selectedRouteId).sort((a,b) => a.displayOrder - b.displayOrder);

  const deleteAlternative = async (alternative: TollAlternative) => {
    if (deleteRequestInFlightRef.current) return;
    if (!window.confirm(`“${alternative.name}” alternatifini silmek istediğinize emin misiniz? Yalnız bu alternatif silinecektir.`)) return;
    deleteRequestInFlightRef.current = true;
    setDeletingAlternativeId(alternative.id);
    try {
      const response = await fetch(`/admin/api/pricing/tolls/alternatives/${alternative.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Alternatif silinemedi.');
      if (editingAlternativeId === alternative.id) setEditingAlternativeId(null);
      await onRefresh();
    } catch (error: unknown) {
      alert(errorMessage(error, 'Alternatif silinemedi.'));
    } finally {
      deleteRequestInFlightRef.current = false;
      setDeletingAlternativeId(null);
    }
  };

  useEffect(() => {
    setComparison({});
    if (!selectedRouteId || !compareVehicleId) return;
    setComparisonLoading(true);
    fetch(`/admin/api/pricing/tolls/route-alternatives/${selectedRouteId}?vehicleId=${compareVehicleId}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        const list: AlternativeComparison[] = json?.alternatives ?? [];
        const byId: Record<string, AlternativeComparison> = {};
        for (const alt of list) byId[alt.id] = alt;
        setComparison(byId);
      })
      .catch(() => {})
      .finally(() => setComparisonLoading(false));
  }, [selectedRouteId, compareVehicleId]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-sm min-h-[500px]">
      <div className="max-w-2xl mb-8">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Maliyet Profili Çalışılacak Rota</label>
        <select 
          value={selectedRouteId} 
          onChange={e => setSelectedRouteId(e.target.value)} 
          className="w-full min-h-[52px] bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
        >
           <option value="">-- Listeden Rota Seçiniz --</option>
           {data.routes.map(r => <option key={r.id} value={r.id}>{r.name} {!r.active ? '(Pasif)' : ''}</option>)}
        </select>
      </div>

      {selectedRouteId ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5 tracking-tight">
               <Navigation className="text-blue-600" size={22} /> Geçiş Alternatifleri
            </h3>
             <AdminActionButton
               label="Yeni Alternatif"
               icon={Plus}
               variant="new"
               onClick={() => setNewAltModal({ routeId: selectedRouteId })}
             />
          </div>

          {routeAlts.length > 1 && (
            <div className="mb-6 p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
              <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Maliyet Karşılaştırması — Araç Seçin</label>
              <select
                value={compareVehicleId}
                onChange={e => setCompareVehicleId(e.target.value)}
                className="w-full sm:w-80 min-h-[44px] bg-white border border-blue-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
              >
                <option value="">-- Karşılaştırmak için araç seçin --</option>
                {compareVehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <p className="text-[10px] font-medium text-blue-700 mt-2 leading-relaxed">Seçilen araç için her alternatifin toplam geçiş ücreti aşağıda gösterilir, böylece hangisinin varsayılan yapılacağına karar verebilirsiniz. Bu tutarlar yalnızca admin panelinde görünür, müşteriye asla gösterilmez.</p>
            </div>
          )}
          
          {routeAlts.length === 0 ? (
             <div className="text-center py-16 px-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl">
                <Navigation size={40} className="mx-auto text-slate-300 mb-4" />
                <h4 className="text-lg font-black text-slate-700 mb-2">Alternatif Bulunmuyor</h4>
                <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Bu rota için henüz bir geçiş alternatifi tanımlanmamış. Maliyet hesabında otoyol/köprü geçişi yansıtılmayacaktır.</p>
             </div>
          ) : (
             <div className="flex flex-col gap-4">
                 {routeAlts.map(alt => editingAlternativeId === alt.id ? (
                    <div key={alt.id} data-testid={`alternative-editor-${alt.id}`} className="rounded-xl border border-blue-300 bg-blue-50/30 p-4 shadow-sm sm:p-5">
                      <AlternativeForm
                        inline
                        routeId={selectedRouteId}
                        routes={data.routes}
                        points={data.points}
                        tariffs={data.tariffs}
                        initialData={alt}
                        onSave={async () => {
                          await onRefresh();
                          setEditingAlternativeId(null);
                        }}
                        onClose={() => setEditingAlternativeId(null)}
                      />
                    </div>
                 ) : (
                    <div key={alt.id} data-testid={`alternative-card-${alt.id}`} className="p-5 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-5 justify-between bg-white hover:border-blue-300 transition-all shadow-sm">
                     <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3.5">
                           <div className="font-black text-slate-900 text-base">{alt.name}</div>
                           {alt.isDefault && <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest">Varsayılan Alternatif</span>}
                           {!alt.active && <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest">Pasif</span>}
                        </div>

                        {compareVehicleId && (
                          <div className="mb-3.5 text-sm font-black">
                            {comparisonLoading ? (
                              <span className="text-slate-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Hesaplanıyor…</span>
                            ) : comparison[alt.id]?.totalKurus != null ? (
                              <span className="text-slate-900">Toplam geçiş ücreti: <span className="text-blue-700">{formatTRY(comparison[alt.id].totalKurus)}</span></span>
                            ) : comparison[alt.id]?.bannedPointNames?.length ? (
                              <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                                <span className="font-black uppercase tracking-widest">Araç için yasaklı — hesaplanamadı</span>
                                <span className="mt-1 block font-bold normal-case tracking-normal">{comparison[alt.id].bannedPointNames!.join(', ')}</span>
                              </div>
                            ) : (
                              <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                                <span className="font-black uppercase tracking-widest">Eksik tarife — hesaplanamadı</span>
                                {comparison[alt.id]?.missingTariffPointNames?.length ? (
                                  <span className="mt-1 block font-bold normal-case tracking-normal">
                                    Eksik: {comparison[alt.id].missingTariffPointNames!.join('; ')}. Geçiş Noktaları ve Maliyetler bölümündeki Hızlı Tarife Ekle alanından tamamlayın.
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2.5">
                           {alt.pointIds.map(pid => {
                              const p = data.points.find(x => x.id === pid);
                              if (!p) return null;
                               const pair = p.pricingMode === 'GATE_PAIR' ? alt.gatePairs?.[pid] : undefined;
                              return (
                                 <div key={pid} className="flex items-start gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                   <MapPin size={12} className="mt-0.5 shrink-0 text-blue-500" />
                                   <span className="text-xs font-bold text-slate-700">
                                     {p.name}
                                     {pair && <span className="block text-[10px] font-semibold text-slate-500">{pair.entryGateName} → {pair.exitGateName}</span>}
                                   </span>
                                </div>
                              );
                           })}
                           {alt.pointIds.length === 0 && (
                             <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                               <AlertCircle size={14} /> Hiçbir geçiş noktası seçilmemiş
                             </span>
                           )}
                        </div>
                     </div>
                       <AdminRecordActions
                         edit={{ onClick: () => setEditingAlternativeId(alt.id) }}
                         delete={{
                           onClick: () => deleteAlternative(alt),
                           disabled: deletingAlternativeId === alt.id,
                         }}
                       />
                   </div>
                ))}
             </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 px-6 bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl">
          <Navigation size={48} className="mx-auto text-slate-200 mb-5" />
          <h4 className="text-xl font-black text-slate-800 mb-2">Rota Seçimi Bekleniyor</h4>
          <p className="text-sm font-medium text-slate-500 max-w-md mx-auto leading-relaxed">Rota bazlı köprü, tünel ve otoyol alternatiflerini yönetmek için lütfen yukarıdaki menüden üzerinde çalışmak istediğiniz rotayı seçiniz.</p>
        </div>
      )}

      {newAltModal && (
        <Modal title="Yeni Alternatif Ekle" onClose={() => setNewAltModal(null)}>
           <AlternativeForm 
              routeId={newAltModal.routeId}
             routes={data.routes}
             points={data.points}
             tariffs={data.tariffs}
              onSave={() => { setNewAltModal(null); onRefresh(); }}
              onClose={() => setNewAltModal(null)}
           />
        </Modal>
      )}
    </div>
  );
}

function SettingsPanel() {
  const emptyForm = { organizationName: '', serviceUrl: '', apiCode: '', active: true };
  const [integrations, setIntegrations] = useState<TollIntegrationSettings[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const requestInFlightRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const loadSettings = useCallback(async () => {
    const loadSequence = ++loadSequenceRef.current;
    setInitialLoading(true);
    try {
      const response = await fetch('/admin/api/pricing/tolls/integration-settings');
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'API entegrasyonları yüklenemedi.');
      if (loadSequence !== loadSequenceRef.current) return;
      setIntegrations(Array.isArray(result.integrations) ? result.integrations : []);
      setCanManage(result.canManage === true);
      setError('');
    } catch (cause: unknown) {
      if (loadSequence !== loadSequenceRef.current) return;
      setError(errorMessage(cause, 'API entegrasyonları yüklenemedi.'));
    } finally {
      if (loadSequence === loadSequenceRef.current) setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const validHttps = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch { return false; }
  };
  const editing = integrations.find(item => item.id === editingId) ?? null;
  const canSave = formData.organizationName.trim().length >= 2
    && validHttps(formData.serviceUrl.trim())
    && (!!editing || !!formData.apiCode.trim());

  const closeForm = () => {
    setCreateOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
    setError('');
  };

  const beginEdit = (item: TollIntegrationSettings) => {
    setCreateOpen(false);
    setEditingId(item.id);
    setFormData({ organizationName: item.organizationName, serviceUrl: item.serviceUrl, apiCode: '', active: item.active });
    setError('');
  };

  const handleSave = async (id?: number) => {
    if (requestInFlightRef.current || !canSave) return;
    requestInFlightRef.current = true;
    setLoadingKey(id ? `save-${id}` : 'create');
    setError('');
    try {
      const payload: { organizationName: string; serviceUrl: string; active: boolean; apiCode?: string } = {
        organizationName: formData.organizationName.trim(),
        serviceUrl: formData.serviceUrl.trim(),
        active: formData.active,
      };
      if (formData.apiCode.trim()) payload.apiCode = formData.apiCode.trim();
      const res = await fetch(id
        ? `/admin/api/pricing/tolls/integration-settings/${id}`
        : '/admin/api/pricing/tolls/integration-settings', {
        method: id ? 'PATCH' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      await loadSettings();
      closeForm();
    } catch (error: unknown) {
      setError(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      requestInFlightRef.current = false;
      setLoadingKey(null);
    }
  };

  const handleToggle = async (item: TollIntegrationSettings) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoadingKey(`toggle-${item.id}`);
    setError('');
    try {
      const response = await fetch(`/admin/api/pricing/tolls/integration-settings/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: item.organizationName, serviceUrl: item.serviceUrl, active: !item.active }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'Durum değiştirilemedi.');
      await loadSettings();
    } catch (cause: unknown) {
      setError(errorMessage(cause, 'Durum değiştirilemedi.'));
    } finally {
      requestInFlightRef.current = false;
      setLoadingKey(null);
    }
  };

  const handleDelete = async (item: TollIntegrationSettings) => {
    if (requestInFlightRef.current) return;
    const confirmed = window.confirm(`“${item.organizationName}” API entegrasyonunu silmek istediğinize emin misiniz?`);
    if (!confirmed) return;
    requestInFlightRef.current = true;
    setLoadingKey(`delete-${item.id}`);
    setError('');
    try {
      const response = await fetch(`/admin/api/pricing/tolls/integration-settings/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: item.organizationName }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? 'API entegrasyonu silinemedi.');
      if (editingId === item.id) closeForm();
      await loadSettings();
    } catch (cause: unknown) {
      setError(errorMessage(cause, 'API entegrasyonu silinemedi.'));
    } finally {
      requestInFlightRef.current = false;
      setLoadingKey(null);
    }
  };

  const form = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Kurum Adı</label>
        <input data-testid="integration-organization" type="text" maxLength={200} value={formData.organizationName} onChange={e => setFormData(f => ({ ...f, organizationName: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Kurum API/Servis Linki</label>
        <input data-testid="integration-service-url" type="url" value={formData.serviceUrl} onChange={e => setFormData(f => ({ ...f, serviceUrl: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="https://..." />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">API Kodu/Anahtarı</label>
        <input data-testid="integration-api-code" type="password" autoComplete="new-password" value={formData.apiCode} onChange={e => setFormData(f => ({ ...f, apiCode: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder={editing ? 'Değiştirmeyecekseniz boş bırakın' : 'API kodunu girin'} />
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">{editing ? `Mevcut anahtar ${editing.maskedApiCode}; açık değer forma yüklenmez.` : 'Anahtar şifreli saklanır ve açık değer tekrar gösterilmez.'}</p>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 rounded-lg p-2 text-sm font-bold text-slate-800">
        <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({ ...f, active: e.target.checked }))} className="h-5 w-5" />
        Aktif
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2">
        <AdminActionButton label="Vazgeç" icon={X} variant="cancel" onClick={closeForm} disabled={loadingKey !== null} />
        <AdminActionButton testId="integration-save" label="Kaydet" icon={Save} variant="save" onClick={() => handleSave(editing?.id)} disabled={!canSave || loadingKey !== null} loading={loadingKey === (editing ? `save-${editing.id}` : 'create')} />
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="mb-1.5 flex items-center gap-2.5 text-lg font-black text-slate-900"><KeyRound className="text-blue-600" size={22} /> API Entegrasyonu</h3>
          <p className="max-w-2xl text-sm font-medium text-slate-500">Kurum servislerini ileride kullanılmak üzere güvenli biçimde saklayın. Bu ekran bağlantı kurmaz ve otomatik veri çekmez.</p>
        </div>
        {canManage && <AdminActionButton label="Yeni API Ekle" icon={Plus} variant="new" onClick={() => { setEditingId(null); setFormData(emptyForm); setCreateOpen(true); setError(''); }} disabled={loadingKey !== null || createOpen} />}
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>
      )}

      {initialLoading ? (
        <div className="flex min-h-[180px] items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-4">
          {createOpen && <div data-testid="integration-create-form" className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 md:p-5">{form}</div>}
          {integrations.length === 0 && !createOpen && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">Kayıtlı API entegrasyonu yok.</div>}
          {integrations.map(item => (
            <div key={item.id} data-testid={`integration-card-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {editingId === item.id ? form : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className="break-words text-sm font-black text-slate-900">{item.organizationName}</h4>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.active ? 'Aktif' : 'Pasif'}</span>
                    </div>
                    <a href={item.serviceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] max-w-full items-center break-all py-2 text-xs font-bold text-blue-700 hover:underline">{item.serviceUrl}</a>
                    <div className="mt-2 text-xs font-bold text-slate-500">API anahtarı: <span data-testid={`integration-mask-${item.id}`} className="font-mono text-slate-800">{item.maskedApiCode}</span></div>
                  </div>
                  {canManage && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:shrink-0">
                    <AdminActionButton label="Düzenle" icon={Edit2} variant="edit" onClick={() => beginEdit(item)} disabled={loadingKey !== null} />
                    <AdminActionButton label={item.active ? 'Pasifleştir' : 'Aktifleştir'} icon={item.active ? PowerOff : Power} variant={item.active ? 'deactivate' : 'activate'} onClick={() => handleToggle(item)} disabled={loadingKey !== null} loading={loadingKey === `toggle-${item.id}`} />
                    <AdminActionButton label="Sil" icon={Trash2} variant="delete" onClick={() => handleDelete(item)} disabled={loadingKey !== null} loading={loadingKey === `delete-${item.id}`} />
                  </div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---
export default function TollManagementClient() {
  const [data, setData] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'POINTS' | 'ALTERNATIVES' | 'SETTINGS'>('POINTS');
  const loadRequestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    try {
      const res = await fetch('/admin/api/pricing/tolls');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Veri yüklenemedi');
      if (requestId !== loadRequestIdRef.current) return;
      setData(json);
      setError('');
    } catch (error: unknown) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(errorMessage(error, 'Veri yüklenemedi'));
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sistem Yükleniyor</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-red-700 bg-red-50 rounded-xl border border-red-200 flex items-start gap-4">
        <AlertCircle size={24} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-black text-lg mb-1">Veri Çekme Hatası</h2>
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl text-white shadow-md">
        <div>
          <h1 className="text-2xl font-black tracking-tight mb-1">Yol ve Geçiş Ücretleri Komuta Merkezi</h1>
          <p className="text-sm font-medium text-slate-400">VIP Transfer rota maliyet hesaplamaları için geçiş noktaları ve alternatif tarife yönetimi.</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto px-1">
        <button 
          onClick={() => setActiveTab('POINTS')} 
          className={`flex items-center gap-2 px-6 py-3.5 min-h-[44px] text-sm font-bold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === 'POINTS' ? 'border-blue-600 text-blue-800 bg-blue-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl'}`}
        >
          <MapPin size={18} /> Geçiş Noktaları ve Maliyetler
        </button>
        <button 
          onClick={() => setActiveTab('ALTERNATIVES')} 
          className={`flex items-center gap-2 px-6 py-3.5 min-h-[44px] text-sm font-bold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === 'ALTERNATIVES' ? 'border-blue-600 text-blue-800 bg-blue-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl'}`}
        >
          <Navigation size={18} /> Rota Kombinasyonları
        </button>
        <button 
          onClick={() => setActiveTab('SETTINGS')} 
          className={`flex items-center gap-2 px-6 py-3.5 min-h-[44px] text-sm font-bold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === 'SETTINGS' ? 'border-blue-600 text-blue-800 bg-blue-50/80 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl'}`}
        >
          <Settings2 size={18} /> Ayarlar
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'POINTS' ? (
          <PointsManager
            data={data}
            onRefresh={loadData}
            onTariffUpdated={(updatedTariff) => setData((current) => current ? {
              ...current,
              tariffs: current.tariffs.map((tariff) => tariff.id === updatedTariff.id ? updatedTariff : tariff),
            } : current)}
          />
        ) : activeTab === 'ALTERNATIVES' ? (
          <AlternativesManager data={data} onRefresh={loadData} />
        ) : (
           <SettingsPanel />
        )}
      </div>
    </div>
  );
}
