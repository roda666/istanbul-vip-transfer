'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { schedulerGuidance } from '@/lib/studio/draft-cadence';

type Period = 'daily' | 'weekly' | 'monthly';
type CadenceResponse = {
  cadence: {
    period: Period;
    quantity: number;
    timezone: string;
    lastExecutedAt: string | null;
    nextDueAt: string | null;
    updatedAt: string | null;
  };
  scheduler: { needsMoreFrequentTrigger: boolean; message: string };
  message?: string;
};

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Günde',
  weekly: 'Haftada',
  monthly: 'Ayda',
};

function formatWhen(value: string | null, timezone: string) {
  if (!value) return 'Henüz çalışmadı';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: timezone,
  }).format(new Date(value));
}

export default function DraftCadencePanel() {
  const [data, setData] = useState<CadenceResponse | null>(null);
  const [period, setPeriod] = useState<Period>('weekly');
  const [quantity, setQuantity] = useState(1);
  const [timezone, setTimezone] = useState('Europe/Istanbul');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((next: CadenceResponse) => {
    setData(next);
    setPeriod(next.cadence.period);
    setQuantity(next.cadence.quantity);
    setTimezone(next.cadence.timezone);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch('/admin/api/studio/draft-cadence', { signal: controller.signal });
      const payload = await res.json().catch(() => null) as (CadenceResponse & { error?: string }) | null;
      if (!res.ok) throw new Error(payload?.error ?? 'Ayarlar yüklenemedi.');
      apply(payload as CadenceResponse);
    } catch (error) {
      const nextError = error instanceof DOMException && error.name === 'AbortError'
        ? 'Taslak sıklığı ayarları zaman aşımına uğradı. Lütfen yeniden deneyin.'
        : error instanceof Error ? error.message : 'Ayarlar yüklenemedi.';
      setLoadError(nextError);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [apply]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch('/admin/api/studio/draft-cadence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, quantity: Number(quantity), timezone }),
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => null) as (CadenceResponse & { error?: string }) | null;
      if (!res.ok) throw new Error(payload?.error ?? 'Ayarlar kaydedilemedi.');
      apply(payload as CadenceResponse);
      setMessage(payload?.message ?? 'Kaydedildi.');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError'
        ? 'Kaydetme isteği zaman aşımına uğradı. Lütfen yeniden deneyin.'
        : error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.');
    } finally {
      window.clearTimeout(timeout);
      setSaving(false);
    }
  };

  const guidance = schedulerGuidance(period);
  return (
    <section style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF7ED', color: '#C99A32', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <CalendarClock size={16} />
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', color: '#172B3A', fontWeight: 700, fontSize: 13 }}>Otomatik Taslak Sıklığı</p>
          <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 11 }}>Yalnızca taslak oluşturur; hiçbir içerik otomatik yayınlanmaz.</p>
        </div>
      </div>

      {loading ? <p style={{ margin: 0, color: '#52697A', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>Ayarlar yükleniyor…</p> : loadError ? (
        <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 11px', color: '#B42318', fontSize: 12, lineHeight: 1.45, fontFamily: 'Inter, sans-serif' }}>
          <p style={{ margin: '0 0 10px' }}>{loadError}</p>
          <button onClick={() => void load()} style={{ border: '1px solid #FCA5A5', borderRadius: 6, padding: '6px 9px', background: '#fff', color: '#B42318', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 78px', gap: 8 }}>
            <label style={{ display: 'grid', gap: 5, color: '#52697A', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
              Periyot
              <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} style={{ border: '1px solid #D8E1E9', borderRadius: 7, padding: '8px', color: '#172B3A', background: '#fff' }}>
                <option value="daily">Günde X adet</option>
                <option value="weekly">Haftada X adet</option>
                <option value="monthly">Ayda X adet</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, color: '#52697A', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
              Adet
              <input type="number" min={1} max={10} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} style={{ border: '1px solid #D8E1E9', borderRadius: 7, padding: '8px', color: '#172B3A' }} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 5, color: '#52697A', fontSize: 11, fontFamily: 'Inter, sans-serif', marginTop: 10 }}>
            Zaman dilimi
            <select value={timezone} onChange={(event) => setTimezone(event.target.value)} style={{ border: '1px solid #D8E1E9', borderRadius: 7, padding: '8px', color: '#172B3A', background: '#fff' }}>
              <option value="Europe/Istanbul">Europe/Istanbul (Türkiye)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </label>

          <p style={{ margin: '12px 0 0', color: '#172B3A', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Aktif hedef: {PERIOD_LABELS[period]} {quantity} adet
          </p>
          <div style={{ marginTop: 10, padding: '10px 11px', borderRadius: 8, background: guidance?.needsMoreFrequentTrigger ? '#FFF7ED' : '#F0FDF4', color: guidance?.needsMoreFrequentTrigger ? '#9A6700' : '#166534', display: 'flex', gap: 7, fontSize: 11, lineHeight: 1.45, fontFamily: 'Inter, sans-serif' }}>
            {guidance?.needsMoreFrequentTrigger ? <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{guidance?.message ?? 'Zamanlayıcı bilgisi yükleniyor.'}</span>
          </div>
          {data && (
            <div style={{ marginTop: 10, fontFamily: 'Inter, sans-serif', color: '#52697A', fontSize: 11, lineHeight: 1.7 }}>
              <div>Son çalışma: <strong style={{ color: '#172B3A' }}>{formatWhen(data.cadence.lastExecutedAt, data.cadence.timezone)}</strong></div>
              <div>Sonraki uygun slot: <strong style={{ color: '#172B3A' }}>{formatWhen(data.cadence.nextDueAt, data.cadence.timezone)}</strong></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => void save()} disabled={saving} style={{ flex: 1, border: 0, borderRadius: 7, padding: '9px 10px', background: '#132A44', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Kaydediliyor…' : 'Sıklığı Kaydet'}
            </button>
            <button onClick={() => void load()} disabled={loading || saving} title="Yenile" style={{ border: '1px solid #D8E1E9', borderRadius: 7, background: '#fff', color: '#52697A', padding: '0 10px', cursor: 'pointer' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          {message && <p style={{ margin: '9px 0 0', fontFamily: 'Inter, sans-serif', fontSize: 11, color: message === 'Kaydedildi.' ? '#168C5B' : '#B42318' }}>{message}</p>}
        </>
      )}
    </section>
  );
}