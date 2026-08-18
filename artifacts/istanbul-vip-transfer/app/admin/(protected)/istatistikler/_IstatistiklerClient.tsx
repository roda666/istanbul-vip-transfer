'use client';

/**
 * Admin analytics dashboard — data comes from the project's own DB,
 * no external analytics API needed.
 */

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface DailyRow    { day: string; count: number }
interface GroupedRow  { [key: string]: string | number; count: number }

interface Analytics {
  daily:              DailyRow[];
  byLocale:           GroupedRow[];
  byService:          GroupedRow[];
  byNewsletterStatus: GroupedRow[];
  totals: {
    total_all_time: number;
    total_30d:      number;
    total_7d:       number;
    confirmed:      number;
    completed:      number;
  };
}

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT_TRANSFER: 'Havalimanı',
  INTERCITY:        'Şehirler Arası',
  ALLOCATION:       'Araç Tahsisi',
  TOUR:             'Özel Tur',
  CONTACT_INQUIRY:  'İletişim Formu',
};

const NEWSLETTER_LABELS: Record<string, string> = {
  ACTIVE:       'Aktif',
  PENDING:      'Onay Bekliyor',
  UNSUBSCRIBED: 'Abonelik İptal',
  SUPPRESSED:   'Engellendi',
};

const LOCALE_FLAGS: Record<string, string> = {
  tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ru: '🇷🇺',
  ar: '🇸🇦', es: '🇪🇸', fr: '🇫🇷', it: '🇮🇹', nl: '🇳🇱',
};

/* ── Mini horizontal bar chart ───────────────────────────────────────────── */
function BarChart({
  data, labelKey, valueKey, labelFn, maxBarWidth = 220,
}: {
  data: GroupedRow[];
  labelKey: string;
  valueKey?: string;
  labelFn?: (v: string) => string;
  maxBarWidth?: number;
}) {
  const key = valueKey ?? 'count';
  const max = Math.max(...data.map(r => Number(r[key])), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((row, i) => {
        const label = labelFn ? labelFn(String(row[labelKey])) : String(row[labelKey]);
        const val   = Number(row[key]);
        const pct   = (val / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '120px', fontSize: '12px', color: '#475569', fontFamily: 'Inter, sans-serif', textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </span>
            <div style={{ flex: 1, background: '#EFF6FF', borderRadius: '4px', overflow: 'hidden', maxWidth: `${maxBarWidth}px` }}>
              <div style={{ width: `${pct}%`, height: '20px', background: '#3B82F6', borderRadius: '4px', minWidth: val > 0 ? '4px' : '0' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', fontFamily: 'Inter, sans-serif', minWidth: '24px' }}>
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Daily sparkline (30-day) ─────────────────────────────────────────────── */
function DailyChart({ data }: { data: DailyRow[] }) {
  // Fill in missing days so we always have 30 slots
  const slots: { label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = data.find(r => r.day.slice(0, 10) === key);
    slots.push({ label: key, count: found?.count ?? 0 });
  }
  const max = Math.max(...slots.map(s => s.count), 1);
  const BAR_H = 80;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${BAR_H}px` }}>
        {slots.map((s, i) => {
          const h = Math.max((s.count / max) * BAR_H, s.count > 0 ? 4 : 2);
          return (
            <div
              key={i}
              title={`${s.label}: ${s.count} talep`}
              style={{
                flex: 1,
                height: `${h}px`,
                background: s.count > 0 ? '#3B82F6' : '#E2E8F0',
                borderRadius: '2px 2px 0 0',
                cursor: 'default',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          {slots[0]?.label.slice(5)}
        </span>
        <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          {slots[slots.length - 1]?.label.slice(5)}
        </span>
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', fontFamily: 'Inter, sans-serif', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', fontFamily: 'Inter, sans-serif', margin: '0 0 2px', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', margin: 0 }}>{sub}</p>}
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#334155', fontFamily: 'Inter, sans-serif', margin: '0 0 16px' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function IstatistiklerClient() {
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/analytics');
      if (!res.ok) throw new Error();
      setData(await res.json());
      setRefreshedAt(new Date());
    } catch {
      setError('İstatistikler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const fmt = (d: Date) => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(d);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
      Yükleniyor…
    </div>
  );

  if (error) return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '14px', color: '#DC2626', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
      {error}
    </div>
  );

  if (!data) return null;

  const t = data.totals;
  // Newsletter active count
  const activeNews = data.byNewsletterStatus.find(r => r.status === 'ACTIVE')?.count ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Refresh bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          Son güncelleme: {fmt(refreshedAt)}
        </span>
        <button
          onClick={fetchData}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '12px', color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          <RefreshCw size={12} /> Yenile
        </button>
      </div>

      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard label="Son 7 Gün"      value={t.total_7d}      sub="rezervasyon talebi" />
        <StatCard label="Son 30 Gün"     value={t.total_30d}     sub="rezervasyon talebi" />
        <StatCard label="Tüm Zamanlar"   value={t.total_all_time} sub="rezervasyon talebi" />
        <StatCard label="Onaylanan"      value={t.confirmed}      sub="onaylandı" />
        <StatCard label="Tamamlanan"     value={t.completed}      sub="tamamlandı" />
        <StatCard label="Bülten Abonesi" value={activeNews}       sub="aktif abone" />
      </div>

      {/* Daily chart */}
      <Section title="Son 30 Günde Günlük Talepler">
        <DailyChart data={data.daily} />
      </Section>

      {/* Breakdown grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>

        <Section title="Dile Göre Talepler (Son 90 Gün)">
          {data.byLocale.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Veri yok</p>
          ) : (
            <BarChart
              data={data.byLocale}
              labelKey="locale"
              labelFn={(v) => `${LOCALE_FLAGS[v] ?? '🌐'} ${v.toUpperCase()}`}
            />
          )}
        </Section>

        <Section title="Hizmete Göre Talepler (Son 90 Gün)">
          {data.byService.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Veri yok</p>
          ) : (
            <BarChart
              data={data.byService}
              labelKey="service_type"
              labelFn={(v) => SERVICE_LABELS[v] ?? v}
            />
          )}
        </Section>

        <Section title="Bülten Aboneleri">
          {data.byNewsletterStatus.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>Henüz abone yok</p>
          ) : (
            <BarChart
              data={data.byNewsletterStatus}
              labelKey="status"
              labelFn={(v) => NEWSLETTER_LABELS[v] ?? v}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
