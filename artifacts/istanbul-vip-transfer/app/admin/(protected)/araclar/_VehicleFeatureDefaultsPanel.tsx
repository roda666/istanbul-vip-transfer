'use client';

import { useEffect, useState } from 'react';
import { VEHICLE_FEATURE_CATALOG } from '@/lib/vehicle-feature-catalog';

const GOLD = '#C9A84C';
const BORDER = '#D8E1E9';
const TEXT = '#172033';
const MUTED = '#64748B';

/**
 * Fleet-wide default "ek özellikler" (amenity) codes shown on any vehicle
 * card whose own feature list is empty. A vehicle with its own selection
 * (see the vehicle edit form) always overrides this — this panel only fills
 * the gap so every card reads consistently instead of some showing tags and
 * others none purely because nobody has filled that field in yet.
 */
export default function VehicleFeatureDefaultsPanel() {
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/admin/api/vehicle-feature-defaults');
        const data = await res.json();
        if (!cancelled && res.ok) setCodes(data.codes ?? []);
      } catch {
        // Silent — panel simply shows the empty state; not fatal.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggle(code: string) {
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/vehicle-feature-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Kaydedilemedi.');
      setCodes(data.codes ?? codes);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${BORDER}`,
        borderRadius: '10px',
        padding: '16px 18px',
        marginBottom: '20px',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: TEXT, fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            Varsayılan Özellikler
          </div>
          <div style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
            Kendi özelliği tanımlanmamış araçlarda gösterilecek ortak liste
          </div>
        </div>
        <span style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
          {open ? 'Kapat ▲' : 'Düzenle ▼'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '14px' }}>
          {loading ? (
            <p style={{ color: MUTED, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Yükleniyor…</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {VEHICLE_FEATURE_CATALOG.map(({ code, label }) => {
                  const checked = codes.includes(code);
                  return (
                    <label
                      key={code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '7px',
                        border: `1px solid ${checked ? GOLD : BORDER}`,
                        background: checked ? 'rgba(201,168,76,0.1)' : '#FFFFFF',
                        color: TEXT,
                        fontSize: '13px',
                        fontFamily: 'Inter, sans-serif',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(code)} />
                      {label}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                {savedAt && !error && (
                  <span style={{ color: '#16A34A', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    Kaydedildi
                  </span>
                )}
                {error && (
                  <span style={{ color: '#DC2626', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
