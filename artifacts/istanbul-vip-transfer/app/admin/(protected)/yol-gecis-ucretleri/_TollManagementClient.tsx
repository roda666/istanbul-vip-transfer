'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Navigation, Plus, Save, Edit2, 
  RefreshCw, Check, X, AlertCircle, Loader2, Car, ShieldCheck, Clock, Settings2
} from 'lucide-react';

// --- Types ---
type TollPoint = {
  id: string;
  name: string;
  type: 'BRIDGE' | 'TUNNEL' | 'HIGHWAY';
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

const TOLL_DIRECTION_LABELS: Record<string, string> = {
  ONE_WAY: 'Tek Yön (yalnız bir yönde ücretli)',
  TWO_WAY_SAME: 'Çift Yön — Aynı Tarife (gidiş+dönüş aynı tutar, ikiye katlanır)',
  TWO_WAY_DIRECTIONAL: 'Çift Yön — Yöne Göre Farklı Tarife (gidiş ve dönüş ayrı tarifelendirilir)',
};

// Mirrors TOLL_VEHICLE_CLASSES / labels / descriptions in lib/toll-management.ts.
// Duplicated here (rather than imported) because that module pulls in the
// server-only DB client and cannot be bundled into this 'use client' file.
const TOLL_VEHICLE_CLASS_LABELS: Record<string, string> = {
  class_1: 'Sınıf 1', class_2: 'Sınıf 2', class_3: 'Sınıf 3',
  class_4: 'Sınıf 4', class_5: 'Sınıf 5', class_6: 'Sınıf 6',
};
const TOLL_VEHICLE_CLASS_DESCRIPTIONS: Record<string, string> = {
  class_1: 'Aks aralığı 3,20 m’den küçük araçlar (otomobil, panelvan/kamyonet, minibüs örnek olarak verilir — aks aralığını kontrol edin)',
  class_2: 'Aks aralığı 3,20 m ve üzeri, 2 akslı araçlar (minibüs, midibüs, kamyonet vb. dahil olabilir — aks aralığını kontrol edin)',
  class_3: 'Üç akslı her türlü araç',
  class_4: 'Dört ve beş akslı her türlü araç',
  class_5: 'Altı ve üzeri akslı araçlar',
  class_6: 'Motosikletler',
};
// Mirrors TOLL_VEHICLE_CLASS_SELECTION_WARNING in lib/toll-management.ts (see note above).
const TOLL_VEHICLE_CLASS_SELECTION_WARNING =
  'Sınıf, aracın ruhsatındaki aks aralığına/aks sayısına bakılarak seçilmelidir — yolcu sayısına veya "buna benzer araçlar genelde şu sınıftır" gibi bir tahmine göre değil. Bu taksonomi OTOYOL A.Ş. ve YSS Köprüsü/Kuzey Marmara Otoyolu işletmecisinde ortaktır, ancak her aracın sınıfı yine de kendi ruhsatından teyit edilmelidir.';
function vehicleClassLabel(vc: string) {
  return TOLL_VEHICLE_CLASS_LABELS[vc] ?? vc;
}

type TollTimeBand = 'ALL' | 'DAY' | 'NIGHT';

type TollTariff = {
  id: string;
  tollPointId: string;
  vehicleClass: string;
  timeBand: TollTimeBand;
  amountKurus: number;
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

const TIME_BAND_LABELS: Record<TollTimeBand, string> = { ALL: 'Tüm Gün', DAY: 'Gündüz', NIGHT: 'Gece' };
const STALE_REASON_LABELS: Record<'AGE' | 'YEAR_ROLLOVER' | 'SOURCE_EFFECTIVE_DATE_OLD' | 'QUERY_DATE_OLD', string> = {
  AGE: 'Uzun süredir güncellenmedi',
  YEAR_ROLLOVER: 'Yeni yıla girildi, tarife teyit edilmedi',
  SOURCE_EFFECTIVE_DATE_OLD: 'Kaynağın belirttiği yürürlük tarihi eskimiş',
  QUERY_DATE_OLD: 'Sorgulama tarihi eskimiş, yeniden kontrol edilmeli',
};
type SyncPreview = {
  newAmountKurus?: number | null;
  amountKurus?: number | null;
  requiresConfirmation?: boolean;
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

// --- Helpers ---
const formatTRY = (kurus?: number | null) => 
  kurus != null 
    ? (kurus / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }) 
    : '---';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AmountInput({ valueKurus, onChange, label }: { valueKurus: number | null, onChange: (val: number | null) => void, label?: string }) {
  const [str, setStr] = useState(valueKurus != null ? (valueKurus / 100).toFixed(2) : '');

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
      {label && <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}
      <div className="relative">
        <input 
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

function DayNightHourFields({ dayStartHour, nightStartHour, onChange }: { dayStartHour: number | null, nightStartHour: number | null, onChange: (day: number | null, night: number | null) => void }) {
  const enabled = dayStartHour != null && nightStartHour != null;
  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-slate-50 rounded-lg transition-colors -ml-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onChange(e.target.checked ? 6 : null, e.target.checked ? 22 : null)}
          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="font-bold text-sm text-slate-900">Bu noktada gündüz/gece farklı tarife var</span>
      </label>
      {enabled && (
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gündüz Başlangıç Saati</label>
            <input type="number" min="0" max="23" value={dayStartHour ?? 6} onChange={e => onChange(parseInt(e.target.value) || 0, nightStartHour)} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gece Başlangıç Saati</label>
            <input type="number" min="0" max="23" value={nightStartHour ?? 22} onChange={e => onChange(dayStartHour, parseInt(e.target.value) || 0)} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
          </div>
          <p className="text-[10px] font-medium text-slate-500 col-span-2 leading-relaxed">Bu saatler yalnızca bu noktaya özeldir (örn. Avrasya Tüneli); diğer noktaları etkilemez.</p>
        </div>
      )}
    </div>
  );
}

// Tri-state banned-classes editor, shared by PointForm and PointDetail.
// null = unconfirmed (ask owner); [] = confirmed no restriction; non-empty =
// confirmed banned list — the latter two require a source URL.
function BannedClassesEditor({
  classificationLabel, onClassificationLabelChange,
  bannedVehicleClasses, bannedSourceUrl, onChange,
}: {
  classificationLabel: string;
  onClassificationLabelChange: (v: string) => void;
  bannedVehicleClasses: string[] | null;
  bannedSourceUrl: string;
  onChange: (bannedVehicleClasses: string[] | null, bannedSourceUrl: string) => void;
}) {
  const mode: 'unknown' | 'none' | 'list' = bannedVehicleClasses === null ? 'unknown' : bannedVehicleClasses.length === 0 ? 'none' : 'list';
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sınıflandırma Sistemi (isteğe bağlı)</label>
        <input type="text" value={classificationLabel} onChange={e => onClassificationLabelChange(e.target.value)} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: KGM Resmî Sınıf 1-6 ile uyumlu (doğrulandı)" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Araç Sınıfı Yasağı</label>
        <select
          value={mode}
          onChange={e => {
            const next = e.target.value;
            if (next === 'unknown') onChange(null, '');
            else if (next === 'none') onChange([], bannedSourceUrl);
            else onChange(bannedVehicleClasses && bannedVehicleClasses.length ? bannedVehicleClasses : [], bannedSourceUrl);
          }}
          className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
        >
          <option value="unknown">Belirsiz — sahibine sorulmalı</option>
          <option value="none">Onaylı — hiçbir sınıf yasaklı değil</option>
          <option value="list">Onaylı — belirli sınıflar yasaklı</option>
        </select>
      </div>
      {mode === 'list' && (
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(TOLL_VEHICLE_CLASS_LABELS).map(cls => (
            <label key={cls} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={(bannedVehicleClasses ?? []).includes(cls)}
                onChange={e => {
                  const current = bannedVehicleClasses ?? [];
                  const next = e.target.checked ? [...current, cls] : current.filter(c => c !== cls);
                  onChange(next, bannedSourceUrl);
                }}
                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              {vehicleClassLabel(cls)}
            </label>
          ))}
        </div>
      )}
      {mode !== 'unknown' && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak URL <span className="text-red-600">*</span></label>
          <input type="url" value={bannedSourceUrl} onChange={e => onChange(bannedVehicleClasses, e.target.value)} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="https://..." />
          <p className="text-[10px] font-medium text-slate-500 mt-1">Bu bilginin doğrulandığı resmî sayfa veya belge bağlantısı zorunludur.</p>
        </div>
      )}
    </div>
  );
}

// Tolling-direction editor, shared by PointForm and PointDetail. Mirrors the
// tri-state pattern of BannedClassesEditor: null = unconfirmed (fiyat motoru
// bunu bilgilendirici bir uyarıyla birlikte eski davranışa — gidiş tarifesini
// ikiye katlama — devam eder), her doğrulanmış seçim resmî bir kaynak ister.
function DirectionEditor({
  pricingMode, onPricingModeChange,
  tollDirection, tollDirectionSourceUrl, tollDirectionNotes, onChange,
}: {
  pricingMode: 'FLAT' | 'GATE_PAIR';
  onPricingModeChange: (v: 'FLAT' | 'GATE_PAIR') => void;
  tollDirection: TollPoint['tollDirection'];
  tollDirectionSourceUrl: string;
  tollDirectionNotes: string;
  onChange: (tollDirection: TollPoint['tollDirection'], sourceUrl: string, notes: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ücretlendirme Modeli</label>
        <select
          value={pricingMode}
          onChange={e => onPricingModeChange(e.target.value as 'FLAT' | 'GATE_PAIR')}
          className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
        >
          <option value="FLAT">Sabit Tarife (sınıf başına tek tutar)</option>
          <option value="GATE_PAIR">Giriş/Çıkış Gişesi Bazlı (hesaplayıcı tabanlı otoyol kesimi)</option>
        </select>
        {pricingMode === 'GATE_PAIR' && (
          <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">
            Bu modda tek bir tablo yoktur — her tarife satırı belirli bir giriş gişesi + çıkış gişesi çiftine bağlıdır. Rota alternatifinde bu nokta seçildiğinde giriş/çıkış gişesi ayrıca belirtilmelidir.
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçiş Yönü</label>
        <select
          value={tollDirection ?? 'unknown'}
          onChange={e => {
            const next = e.target.value;
            onChange(next === 'unknown' ? null : (next as TollPoint['tollDirection']), tollDirectionSourceUrl, tollDirectionNotes);
          }}
          className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
        >
          <option value="unknown">Belirsiz — sahibine sorulmalı</option>
          {Object.entries(TOLL_DIRECTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">
          Belirsizken gidiş-dönüş hesaplaması eski davranışı korur (gidiş tarifesi ikiye katlanır) ve teklif ekranında bilgilendirici bir uyarı gösterilir.
        </p>
      </div>
      {tollDirection != null && (
        <>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak URL <span className="text-red-600">*</span></label>
            <input type="url" value={tollDirectionSourceUrl} onChange={e => onChange(tollDirection, e.target.value, tollDirectionNotes)} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Not (isteğe bağlı)</label>
            <textarea value={tollDirectionNotes} onChange={e => onChange(tollDirection, tollDirectionSourceUrl, e.target.value)} rows={2} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: Her iki yönde de 1 Ocak 2022'den beri ücretli (KGM sayfası)." />
          </div>
        </>
      )}
    </div>
  );
}

function PointForm({ onSave, onClose }: { onSave: (point: TollPoint) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<{ name: string, type: string, active: boolean, dayStartHour: number | null, nightStartHour: number | null, notes: string, classificationLabel: string, bannedVehicleClasses: string[] | null, bannedVehicleClassesSourceUrl: string, tollDirection: TollPoint['tollDirection'], tollDirectionSourceUrl: string, tollDirectionNotes: string, pricingMode: TollPoint['pricingMode'] }>({ name: '', type: 'BRIDGE', active: true, dayStartHour: null, nightStartHour: null, notes: '', classificationLabel: '', bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: '', tollDirection: null, tollDirectionSourceUrl: '', tollDirectionNotes: '', pricingMode: 'FLAT' });
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    if (formData.bannedVehicleClasses !== null && !formData.bannedVehicleClassesSourceUrl.trim()) {
      alert('Araç sınıfı yasağı belirtildiğinde kaynak URL zorunludur.');
      return;
    }
    if (formData.tollDirection !== null && !formData.tollDirectionSourceUrl.trim()) {
      alert('Geçiş yönü belirtildiğinde kaynak URL zorunludur.');
      return;
    }
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
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nokta Adı</label>
        <input type="text" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: 15 Temmuz Şehitler Köprüsü" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Geçiş Tipi</label>
        <select value={formData.type} onChange={e => setFormData(f => ({...f, type: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
           <option value="BRIDGE">Köprü</option>
           <option value="TUNNEL">Tünel</option>
           <option value="HIGHWAY">Otoyol</option>
        </select>
      </div>
      <DayNightHourFields dayStartHour={formData.dayStartHour} nightStartHour={formData.nightStartHour} onChange={(day, night) => setFormData(f => ({...f, dayStartHour: day, nightStartHour: night}))} />
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Not / Kısıtlama (isteğe bağlı)</label>
        <textarea value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} rows={2} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: Ağır araçlar (Sınıf 3/4/5) bu tünelden geçemez" />
      </div>
      <BannedClassesEditor
        classificationLabel={formData.classificationLabel}
        onClassificationLabelChange={v => setFormData(f => ({ ...f, classificationLabel: v }))}
        bannedVehicleClasses={formData.bannedVehicleClasses}
        bannedSourceUrl={formData.bannedVehicleClassesSourceUrl}
        onChange={(banned, sourceUrl) => setFormData(f => ({ ...f, bannedVehicleClasses: banned, bannedVehicleClassesSourceUrl: sourceUrl }))}
      />
      <DirectionEditor
        pricingMode={formData.pricingMode}
        onPricingModeChange={v => setFormData(f => ({ ...f, pricingMode: v }))}
        tollDirection={formData.tollDirection}
        tollDirectionSourceUrl={formData.tollDirectionSourceUrl}
        tollDirectionNotes={formData.tollDirectionNotes}
        onChange={(direction, sourceUrl, notes) => setFormData(f => ({ ...f, tollDirection: direction, tollDirectionSourceUrl: sourceUrl, tollDirectionNotes: notes }))}
      />
      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-slate-50 rounded-lg transition-colors -ml-2">
        <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <span className="font-bold text-sm text-slate-900">Sistemde Aktif</span>
      </label>
      <div className="flex gap-3 pt-4 border-t border-slate-100">
         <button onClick={onClose} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
         <button onClick={handleSubmit} disabled={loading || !formData.name.trim()} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Noktayı Ekle
         </button>
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
         Bu satırı tutar girmeden boş bırakabilirsiniz — bu, "henüz kaynak bulunamadı" anlamına gelir ve fiyat motoru bu geçişi güvenle eksik veri olarak işaretler. Ancak bir TRY tutarı girerseniz, yalnızca KGM (vatandas.kgm.gov.tr dahil), Avrasya Tüneli, 1915 Çanakkale Köprüsü, OTOYOL A.Ş. veya YSS Köprüsü/Kuzey Marmara Otoyolu işletmecisi gibi resmî bir kaynak adresiyle birlikte kaydedilebilir — üçüncü taraf/karşılaştırma siteleri (ör. sigortam.net) kabul edilmez.
       </div>
       <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] font-semibold text-amber-800 leading-relaxed">
         {TOLL_VEHICLE_CLASS_SELECTION_WARNING}
       </div>

       {point.pricingMode === 'GATE_PAIR' && (
         <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50 space-y-3">
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
       )}

       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Zaman Dilimi</label>
         <select value={formData.timeBand} onChange={e => setFormData(f => ({...f, timeBand: e.target.value as TollTimeBand}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
            <option value="ALL">Tüm Gün (gündüz + gece aynı tarife)</option>
            <option value="DAY">Sadece Gündüz</option>
            <option value="NIGHT">Sadece Gece</option>
         </select>
         <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">
           Gündüz/gece farklı ücretlendiriliyorsa bu araç sınıfı için ayrı ayrı "Sadece Gündüz" ve "Sadece Gece" tarifeleri girin. Aynı anda "Tüm Gün" tarifesiyle çakışamaz.
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

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak Adı (Örn: KGM)</label>
           <input type="text" value={formData.sourceName} onChange={e => setFormData(f => ({...f, sourceName: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm" placeholder="Belirtilmemiş" />
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kaynak URL</label>
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

       <div className="grid grid-cols-2 gap-4">
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

       <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 hover:bg-slate-50 rounded-lg transition-colors mt-2 -ml-2">
         <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
         <span className="font-bold text-sm text-slate-900">Aktif Tarife</span>
       </label>

       <div className="flex gap-3 pt-5 border-t border-slate-100 mt-5">
         <button onClick={onClose} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
         <button onClick={handleSubmit} disabled={loading} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Tarifeyi Kaydet
         </button>
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
        body: JSON.stringify({ action: 'apply', tollTariffId: tariff.id, confirmationText: confirmText })
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
              <button onClick={onClose} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
              <button 
                onClick={handleApply} 
                disabled={loading || (preview.requiresConfirmation && confirmText !== 'TARİFEYİ UYGULA')} 
                className="flex-1 min-h-[44px] py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                 {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                 Uygula
              </button>
            </div>
         </div>
      ) : null}
    </div>
  );
}

function AlternativeForm({ routeId, routes, points, initialData, onSave, onClose }: { routeId: string, routes: Route[], points: TollPoint[], initialData?: TollAlternative, onSave: () => void, onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: initialData?.name ?? '',
     active: initialData?.active ?? true,
     isDefault: initialData?.isDefault ?? false,
     displayOrder: initialData?.displayOrder ?? 0,
     pointIds: initialData?.pointIds ?? [],
     gatePairs: (initialData?.gatePairs ?? {}) as Record<string, { entryGateName: string, exitGateName: string }>,
  });
  const [loading, setLoading] = useState(false);
  const routeName = routes.find(r => r.id === routeId)?.name || 'Bilinmeyen Rota';

  const togglePoint = (pid: string) => {
    setFormData(f => ({
      ...f, 
      pointIds: f.pointIds.includes(pid) ? f.pointIds.filter(id => id !== pid) : [...f.pointIds, pid]
    }));
  };

  const setGatePair = (pid: string, field: 'entryGateName' | 'exitGateName', value: string) => {
    setFormData(f => {
      const current = f.gatePairs[pid] ?? { entryGateName: '', exitGateName: '' };
      const updated = { ...current, [field]: value };
      return { ...f, gatePairs: { ...f.gatePairs, [pid]: updated } };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
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
      };
      
      const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      onSave();
    } catch (error: unknown) {
      alert(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-2">
         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Bağlı Rota</div>
         <div className="font-bold text-slate-900 text-sm">{routeName}</div>
       </div>
       
       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alternatif Adı</label>
         <input type="text" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: 1. Köprü Üzerinden" />
       </div>

       <div>
         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kapsanan Geçiş Noktaları</label>
         <div className="border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {points.map(p => (
              <div key={p.id} className="p-3 hover:bg-slate-50 transition-colors">
                <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                   <input type="checkbox" checked={formData.pointIds.includes(p.id)} onChange={() => togglePoint(p.id)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                   <div>
                     <div className="font-bold text-sm text-slate-900 leading-none">{p.name}</div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.type}{p.pricingMode === 'GATE_PAIR' ? ' • GİŞE BAZLI' : ''}</div>
                   </div>
                </label>
                {formData.pointIds.includes(p.id) && p.pricingMode === 'GATE_PAIR' && (
                  <div className="mt-2 ml-8 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.gatePairs[p.id]?.entryGateName ?? ''}
                      onChange={e => setGatePair(p.id, 'entryGateName', e.target.value)}
                      className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                      placeholder="Giriş gişesi"
                    />
                    <input
                      type="text"
                      value={formData.gatePairs[p.id]?.exitGateName ?? ''}
                      onChange={e => setGatePair(p.id, 'exitGateName', e.target.value)}
                      className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                      placeholder="Çıkış gişesi"
                    />
                    <p className="text-[10px] font-medium text-slate-500 col-span-1 md:col-span-2">Bu nokta gişe bazlı ücretlendiriliyor; bu alternatif için kullanılan giriş/çıkış gişesi çiftini belirtin. Boş bırakılırsa fiyat motoru bu geçişi eksik veri olarak işaretler.</p>
                  </div>
                )}
              </div>
            ))}
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
         <button onClick={onClose} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">İptal</button>
         <button onClick={handleSubmit} disabled={loading || !formData.name.trim()} className="flex-1 min-h-[44px] py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Kaydet
         </button>
       </div>
    </div>
  )
}

function PointDetail({ point, tariffs, vehicleClasses, onRefresh, onEditTariff, onSync }: { point: TollPoint, tariffs: TollTariff[], vehicleClasses: string[], onRefresh: () => void, onEditTariff: (vc: string, t?: TollTariff) => void, onSync: (t: TollTariff) => void }) {
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
    if (formData.bannedVehicleClasses !== null && !formData.bannedVehicleClassesSourceUrl.trim()) {
      alert('Araç sınıfı yasağı belirtildiğinde kaynak URL zorunludur.');
      return;
    }
    if (formData.tollDirection !== null && !formData.tollDirectionSourceUrl.trim()) {
      alert('Geçiş yönü belirtildiğinde kaynak URL zorunludur.');
      return;
    }
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
      onRefresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) {
      alert(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
              <select value={formData.type} onChange={e => setFormData(f => ({...f, type: e.target.value as TollPoint['type']}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all">
                <option value="BRIDGE">Köprü (Bridge)</option>
                <option value="TUNNEL">Tünel (Tunnel)</option>
                <option value="HIGHWAY">Otoyol (Highway)</option>
             </select>
           </div>
        </div>

        <div className="mb-5">
          <DayNightHourFields dayStartHour={formData.dayStartHour} nightStartHour={formData.nightStartHour} onChange={(day, night) => setFormData(f => ({...f, dayStartHour: day, nightStartHour: night}))} />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Not / Kısıtlama (isteğe bağlı)</label>
          <textarea value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} rows={2} className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all" placeholder="Örn: Ağır araçlar (Sınıf 3/4/5) bu tünelden geçemez" />
          <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">Bu alan, gerçek bir iş kuralını (örn. araç geçiş yasağı) belirtir — bu sınıflar için tarife satırı hiç oluşturulmaz ve "eksik veri" olarak değil "uygulanamaz" olarak gösterilir.</p>
        </div>

        <div className="mb-5">
          <BannedClassesEditor
            classificationLabel={formData.classificationLabel}
            onClassificationLabelChange={v => setFormData(f => ({ ...f, classificationLabel: v }))}
            bannedVehicleClasses={formData.bannedVehicleClasses}
            bannedSourceUrl={formData.bannedVehicleClassesSourceUrl}
            onChange={(banned, sourceUrl) => setFormData(f => ({ ...f, bannedVehicleClasses: banned, bannedVehicleClassesSourceUrl: sourceUrl }))}
          />
          <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">Yasaklı olarak işaretlenen bir sınıf, bu noktayı içeren hiçbir alternatifte bu araç için fiyatlandırılmaz — fiyat motoru bu alternatifi tamamen reddeder, "eksik veri" olarak göstermez.</p>
        </div>

        <div className="mb-5">
          <DirectionEditor
            pricingMode={formData.pricingMode}
            onPricingModeChange={v => setFormData(f => ({ ...f, pricingMode: v }))}
            tollDirection={formData.tollDirection}
            tollDirectionSourceUrl={formData.tollDirectionSourceUrl}
            tollDirectionNotes={formData.tollDirectionNotes}
            onChange={(direction, sourceUrl, notes) => setFormData(f => ({ ...f, tollDirection: direction, tollDirectionSourceUrl: sourceUrl, tollDirectionNotes: notes }))}
          />
          <p className="text-[10px] font-medium text-slate-500 mt-1.5 leading-relaxed">Gidiş-dönüş hesaplaması bu ayara göre yapılır: tek yönde bir kez, aynı tarifeyle çift yönde iki katı, veya yöne göre farklı tarifede gidiş+dönüş tarifelerinin toplamı.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <label className="flex items-center gap-3 cursor-pointer min-h-[44px] hover:bg-slate-50 p-2 -ml-2 rounded-lg transition-colors">
             <input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({...f, active: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
             <span className="font-bold text-sm text-slate-900">Sistemde Kullanılabilir (Aktif)</span>
           </label>
           
           <button onClick={handleSave} disabled={loading} className="min-h-[44px] px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
             {loading ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} className="text-emerald-400" /> : <Save size={16} />}
             {saved ? 'Değişiklikler Kaydedildi' : 'Değişiklikleri Kaydet'}
           </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5">
            <Car className="text-slate-600" size={22} /> Araç Sınıfı Tarifeleri
          </h3>
        </div>

        {point.notes && (
          <div className="mx-5 md:mx-6 mt-5 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs font-medium text-blue-900 leading-relaxed flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
            <span><strong>Kısıtlama notu:</strong> {point.notes} — bu kurala göre aşağıda tarifesi bulunmayan sınıflar "eksik veri" değil, kasıtlı olarak tanımsız (uygulanamaz) olabilir.</span>
          </div>
        )}
        
        <div className="p-5 md:p-6 flex flex-col gap-3">
          {vehicleClasses.map(vc => {
             const classTariffs = tariffs.filter(t => t.tollPointId === point.id && t.vehicleClass === vc);
             const activeTariffs = classTariffs.filter(t => t.active);
             const hasAll = activeTariffs.some(t => t.timeBand === 'ALL');
             const hasDay = activeTariffs.some(t => t.timeBand === 'DAY');
             const hasNight = activeTariffs.some(t => t.timeBand === 'NIGHT');
             const isCovered = hasAll || (hasDay && hasNight);
             const hasAnyRowAtAll = classTariffs.length > 0;

             return (
               <div key={vc} className={`flex flex-col p-4 border rounded-xl gap-4 transition-all duration-200 ${classTariffs.length > 0 ? 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm' : 'border-dashed border-slate-300 bg-slate-50/50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-900 text-base tracking-tight">{vehicleClassLabel(vc)}</span>
                      {!isCovered && !hasAnyRowAtAll && point.notes && <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Tarife Yok (Notu Kontrol Edin)</span>}
                      {!isCovered && (!point.notes || hasAnyRowAtAll) && <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Eksik Tarife</span>}
                    </div>
                    <button onClick={() => onEditTariff(vc)} className="min-h-[36px] px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                      <Plus size={14} /> Tarife Ekle
                    </button>
                  </div>

                  {classTariffs.length === 0 ? (
                    <div className="text-xs font-medium text-amber-800 leading-relaxed">Bu araç sınıfı için henüz aktif/geçerli tarife tanımlanmamış. Bu nokta seçili bir rota alternatifindeyse fiyat motoru teklifi güvenle durdurur; eksik veri olarak işaretlenir, asla 0 TRY varsayılmaz.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {!isCovered && (
                        <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                          Mevcut tarifeler tüm zaman dilimlerini kapsamıyor ({hasDay ? 'gündüz var, gece eksik' : hasNight ? 'gece var, gündüz eksik' : 'hiçbir dilim tanımlı değil'}). Kapsanmayan saatlerde fiyat motoru bu geçişi eksik veri olarak işaretler.
                        </div>
                      )}
                      {classTariffs.map(tariff => {
                        const isEffectiveManual = tariff.manualAmountKurus != null;
                        return (
                          <div key={tariff.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-lg gap-4 bg-slate-50/60">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="flex items-center gap-1 text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                                  <Clock size={11} /> {TIME_BAND_LABELS[tariff.timeBand]}
                                </span>
                                {!tariff.active && <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Pasif</span>}
                                {tariff.stale && (
                                  <span title={tariff.staleReasons?.map(r => STALE_REASON_LABELS[r]).join(' • ')} className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle size={11} /> Bayat Tarife
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-4">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Efektif Ücret</span>
                                  <span className={`text-lg font-black tracking-tight ${isEffectiveManual ? 'text-blue-700' : 'text-emerald-700'}`}>
                                    {formatTRY(tariff.amountKurus)}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 mt-0.5">
                                    {tariff.validFrom ? `${new Date(tariff.validFrom).toLocaleDateString('tr-TR')} tarihinden itibaren geçerli` : 'Geçerlilik başlangıcı girilmemiş'}
                                  </span>
                                </div>
                                <div className="h-10 w-px bg-slate-200 mx-1"></div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Manuel Geçersiz Kılma</span>
                                  <span className="text-sm font-bold text-slate-600">{tariff.manualAmountKurus != null ? formatTRY(tariff.manualAmountKurus) : 'Yok'}</span>
                                </div>
                                {tariff.automaticAmountKurus != null && (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                      {tariff.sourceVerified && <ShieldCheck size={12} className="text-emerald-500" />}
                                      {tariff.sourceName || (tariff.sourceVerified ? 'Doğrulanmış Kaynak' : 'Manuel Kayıt')}
                                    </span>
                                    <span className={`text-sm font-bold ${isEffectiveManual ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}>
                                      {formatTRY(tariff.automaticAmountKurus)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:self-end mt-2 sm:mt-0">
                              {tariff.sourceVerified && (
                                <button onClick={() => onSync(tariff)} className="min-h-[40px] px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm border border-slate-200/60">
                                  <RefreshCw size={14} /> Otomatik Çek
                                </button>
                              )}
                              <button onClick={() => onEditTariff(vc, tariff)} className="min-h-[40px] px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm border bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                                <Edit2 size={14} /> Düzenle
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function PointsManager({ data, onRefresh }: { data: DataPayload, onRefresh: () => void }) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [newPointModal, setNewPointModal] = useState(false);
  const [editTariffModal, setEditTariffModal] = useState<{vc: string, tariff?: TollTariff} | null>(null);
  const [syncModalTariff, setSyncModalTariff] = useState<TollTariff | null>(null);

  const selectedPoint = data.points.find(p => p.id === selectedPointId) || null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-1/3 flex flex-col gap-3">
        <button 
          className="flex items-center justify-center gap-2 min-h-[44px] bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm" 
          onClick={() => setNewPointModal(true)}
        >
           <Plus size={16} /> Yeni Geçiş Noktası
        </button>
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 pb-4">
          {data.points.length === 0 ? (
             <div className="text-center p-6 text-sm font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
               Sistemde henüz geçiş noktası yok.
             </div>
          ) : data.points.map(p => (
             <button 
               key={p.id} 
               onClick={() => setSelectedPointId(p.id)} 
               className={`text-left p-4 min-h-[56px] rounded-xl border transition-all duration-200 ${selectedPoint?.id === p.id ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm'}`}
             >
                <div className={`font-black text-sm mb-1.5 ${selectedPoint?.id === p.id ? 'text-blue-900' : 'text-slate-900'}`}>{p.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.type}</span>
                   {!p.active && <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-widest">Pasif</span>}
                   {p.bannedVehicleClasses && p.bannedVehicleClasses.length > 0 && <span className="text-[9px] font-black text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-widest">Araç Yasağı</span>}
                   {p.bannedVehicleClasses === null && <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest">Yasak Belirsiz</span>}
                </div>
             </button>
          ))}
        </div>
      </div>
      
      <div className="w-full lg:w-2/3">
         {selectedPoint ? (
           <div className="animate-in fade-in slide-in-from-right-2 duration-300">
             <PointDetail 
               point={selectedPoint} 
               tariffs={data.tariffs} 
               vehicleClasses={data.vehicleClasses} 
               onRefresh={onRefresh}
               onEditTariff={(vc, t) => setEditTariffModal({vc, tariff: t})}
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

      {newPointModal && (
        <Modal title="Yeni Geçiş Noktası Ekle" onClose={() => setNewPointModal(false)}>
           <PointForm onSave={(p) => { setNewPointModal(false); onRefresh(); setSelectedPointId(p.id); }} onClose={() => setNewPointModal(false)} />
        </Modal>
      )}

      {editTariffModal && selectedPoint && (
        <Modal title={`${selectedPoint.name} — ${vehicleClassLabel(editTariffModal.vc)} Tarifesi`} onClose={() => setEditTariffModal(null)}>
           <TariffForm 
             point={selectedPoint} 
             vClass={editTariffModal.vc} 
             initialData={editTariffModal.tariff} 
             onSave={() => { setEditTariffModal(null); onRefresh(); }} 
             onClose={() => setEditTariffModal(null)} 
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

function AlternativesManager({ data, onRefresh }: { data: DataPayload, onRefresh: () => void }) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [editAltModal, setEditAltModal] = useState<{alt?: TollAlternative, routeId: string} | null>(null);

  const routeAlts = data.alternatives.filter(a => a.routeId === selectedRouteId).sort((a,b) => a.displayOrder - b.displayOrder);

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
            <button 
              onClick={() => setEditAltModal({ routeId: selectedRouteId })} 
              className="min-h-[44px] px-5 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
               <Plus size={16} /> Yeni Alternatif
            </button>
          </div>
          
          {routeAlts.length === 0 ? (
             <div className="text-center py-16 px-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl">
                <Navigation size={40} className="mx-auto text-slate-300 mb-4" />
                <h4 className="text-lg font-black text-slate-700 mb-2">Alternatif Bulunmuyor</h4>
                <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">Bu rota için henüz bir geçiş alternatifi tanımlanmamış. Maliyet hesabında otoyol/köprü geçişi yansıtılmayacaktır.</p>
             </div>
          ) : (
             <div className="flex flex-col gap-4">
                {routeAlts.map(alt => (
                   <div key={alt.id} className="p-5 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-5 justify-between bg-white hover:border-blue-300 transition-all shadow-sm">
                     <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3.5">
                           <div className="font-black text-slate-900 text-base">{alt.name}</div>
                           {alt.isDefault && <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest">Varsayılan Alternatif</span>}
                           {!alt.active && <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest">Pasif</span>}
                           <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest sm:ml-auto">Gösterim: {alt.displayOrder}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2.5">
                           {alt.pointIds.map(pid => {
                              const p = data.points.find(x => x.id === pid);
                              if (!p) return null;
                              return (
                                <div key={pid} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                  <MapPin size={12} className="text-blue-500" />
                                  <span className="text-xs font-bold text-slate-700">{p.name}</span>
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
                     <div className="flex items-center gap-2 sm:self-start mt-2 sm:mt-0">
                        <button 
                          onClick={() => setEditAltModal({ alt, routeId: selectedRouteId })} 
                          className="min-h-[44px] px-5 py-2 bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 hover:border-blue-200 hover:text-blue-800 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                           <Edit2 size={16} /> Düzenle
                        </button>
                     </div>
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

      {editAltModal && (
        <Modal title={editAltModal.alt ? 'Alternatifi Düzenle' : 'Yeni Alternatif Ekle'} onClose={() => setEditAltModal(null)}>
           <AlternativeForm 
             routeId={editAltModal.routeId}
             routes={data.routes}
             points={data.points}
             initialData={editAltModal.alt}
             onSave={() => { setEditAltModal(null); onRefresh(); }}
             onClose={() => setEditAltModal(null)}
           />
        </Modal>
      )}
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: TollSettings, onSaved: (s: TollSettings) => void }) {
  const [formData, setFormData] = useState(settings);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setFormData(settings); }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/admin/api/pricing/tolls/settings', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
      onSaved(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) {
      setError(errorMessage(error, 'Kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-sm max-w-2xl">
      <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5 mb-1.5">
        <Settings2 className="text-blue-600" size={22} /> Bayat Tarife Ayarları
      </h3>
      <p className="text-sm font-medium text-slate-500 mb-6">Bu eşik, geçiş ücretlerinin ne zaman "bayat" (güncellenmesi gereken) olarak işaretleneceğini belirler. Gündüz/gece geçiş saatleri artık her geçiş noktasının kendi sayfasında ayrı ayrı tanımlanır (örn. Avrasya Tüneli), çünkü farklı köprü/tünellerin farklı saatleri olabilir.</p>

      {error && (
        <div className="mb-5 bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-xs font-bold">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bayatlama Eşiği (Gün)</label>
          <input type="number" min="1" max="3650" value={formData.staleAfterDays} onChange={e => setFormData(f => ({...f, staleAfterDays: parseInt(e.target.value) || 1}))} className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
          <p className="text-[10px] font-medium text-slate-500 mt-1.5">Son güncellemeden bu yana bu kadar gün geçtiyse tarife bayat sayılır.</p>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors mb-6">
        <input type="checkbox" checked={formData.warnOnNewYearRollover} onChange={e => setFormData(f => ({...f, warnOnNewYearRollover: e.target.checked}))} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <div>
          <div className="font-bold text-sm text-slate-900">Yeni Yıla Girişte Uyar</div>
          <div className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Takvim yılı değiştiğinde, o tarihten sonra teyit edilmemiş her tarife de bayat olarak işaretlenir (yıllık zam ihtimaline karşı).</div>
        </div>
      </label>

      <button onClick={handleSave} disabled={loading} className="min-h-[44px] px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
        {loading ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} className="text-emerald-400" /> : <Save size={16} />}
        {saved ? 'Ayarlar Kaydedildi' : 'Ayarları Kaydet'}
      </button>
    </div>
  );
}

// --- Main Page Component ---
export default function TollManagementClient() {
  const [data, setData] = useState<DataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'POINTS' | 'ALTERNATIVES' | 'SETTINGS'>('POINTS');

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/pricing/tolls');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Veri yüklenemedi');
      setData(json);
      setError('');
    } catch (error: unknown) {
      setError(errorMessage(error, 'Veri yüklenemedi'));
    } finally {
      setLoading(false);
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
          <PointsManager data={data} onRefresh={loadData} />
        ) : activeTab === 'ALTERNATIVES' ? (
          <AlternativesManager data={data} onRefresh={loadData} />
        ) : (
          <SettingsPanel settings={data.settings} onSaved={(s) => setData(d => d ? { ...d, settings: s } : d)} />
        )}
      </div>
    </div>
  );
}
