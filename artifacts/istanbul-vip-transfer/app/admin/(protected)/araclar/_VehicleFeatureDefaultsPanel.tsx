'use client';

import { useEffect, useState } from 'react';
import { VEHICLE_FEATURE_CATALOG, PUBLIC_VEHICLE_LOCALES } from '@/lib/vehicle-feature-catalog';
import { AdminActionButton } from '@/app/admin/_components/AdminActionButton';

const GOLD = '#C9A84C';
const BORDER = '#D8E1E9';
const TEXT = '#172033';
const MUTED = '#64748B';
const FALLBACK_SAVE_ERROR = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * Fleet-wide default "ek özellikler" (amenity) codes shown on any vehicle
 * card whose own feature list is empty. A vehicle with its own selection
 * (see the vehicle edit form) always overrides this — this panel only fills
 * the gap so every card reads consistently instead of some showing tags and
 * others none purely because nobody has filled that field in yet.
 */
export default function VehicleFeatureDefaultsPanel() {
  const [codes, setCodes] = useState<string[]>([]);
  const [customFeatures, setCustomFeatures] = useState<Array<{ code: string; translations: Record<string, string> }>>([]);
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
        const data = await readJsonResponse(res);
        if (!cancelled && res.ok) {
          setCodes(Array.isArray(data.codes) ? data.codes as string[] : []);
          setCustomFeatures(Array.isArray(data.customFeatures)
            ? data.customFeatures as Array<{ code: string; translations: Record<string, string> }>
            : []);
        }
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
         body: JSON.stringify({ codes, customFeatures }),
      });
       const data = await readJsonResponse(res);
       if (!res.ok) {
         const message = typeof data.error === 'string' && data.error.trim()
           ? data.error
           : FALLBACK_SAVE_ERROR;
         throw new Error(message);
       }
        setCodes(Array.isArray(data.codes) ? data.codes as string[] : codes);
        setCustomFeatures(Array.isArray(data.customFeatures)
          ? data.customFeatures as Array<{ code: string; translations: Record<string, string> }>
          : customFeatures);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error && err.message.trim() ? err.message : FALLBACK_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  function addCustomFeature() {
    const code = `CUSTOM_${Date.now().toString(36)}`;
    setCustomFeatures((prev) => [...prev, {
      code,
      translations: Object.fromEntries(PUBLIC_VEHICLE_LOCALES.map((locale) => [locale, ''])),
    }]);
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
      <AdminActionButton onClick={() => setOpen((v) => !v)} label={open ? 'Kapat' : 'Düzenle'} variant="edit" manage={false} className="w-full justify-between">
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: TEXT, fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            Varsayılan Özellikler
          </div>
          <div style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
            Kendi özelliği tanımlanmamış araçlarda gösterilecek ortak liste
          </div>
        </div>
        <span style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>{open ? '▲' : '▼'}</span>
      </AdminActionButton>

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
              <div style={{ marginTop: '18px' }}>
                <div style={{ color: TEXT, fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Özel özellikler</div>
                <div style={{ color: MUTED, fontSize: '12px', lineHeight: 1.5, marginBottom: '10px' }}>
                   Türkçe metin her kayıtta aktif tüm müşteri dillerine yeniden çevrilir; eski çeviriler korunmaz.
                </div>
                {customFeatures.map((feature, index) => (
                  <div key={feature.code} style={{ border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: '11px' }}>
                      <span>{feature.code}</span>
                       <AdminActionButton type="button" onClick={() => setCustomFeatures((prev) => prev.filter((_, i) => i !== index))} label="Kaldır" variant="delete" manage={false} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '6px', marginTop: '6px' }}>
                      {PUBLIC_VEHICLE_LOCALES.map((locale) => (
                        <label key={locale} style={{ display: 'grid', gap: '5px', fontSize: '11px', color: MUTED, fontWeight: 700 }}>
                           <span>{locale.toUpperCase()}{locale === 'tr' ? ' · Zorunlu' : ' · AI otomatik'}</span>
                           <input
                             value={feature.translations[locale] ?? ''}
                             placeholder={locale === 'tr' ? 'örn. Bebek koltuğu' : 'Kaydedince otomatik çevrilir'}
                             onChange={(event) => setCustomFeatures((prev) => prev.map((item, i) => i === index ? { ...item, translations: { ...item.translations, [locale]: event.target.value } } : item))}
                             style={{ width: '100%', minHeight: '42px', boxSizing: 'border-box', padding: '9px 10px', border: `1px solid ${BORDER}`, borderRadius: '7px', background: '#FFFFFF', color: TEXT, fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border-color 120ms ease, box-shadow 120ms ease' }}
                             onFocus={(event) => { event.currentTarget.style.borderColor = '#2563EB'; event.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.14)'; }}
                             onBlur={(event) => { event.currentTarget.style.borderColor = BORDER; event.currentTarget.style.boxShadow = 'none'; }}
                           />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                 <AdminActionButton type="button" onClick={addCustomFeature} label="Özel Özellik Ekle" variant="new" manage={false} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
                <AdminActionButton onClick={save} disabled={saving} loading={saving} label={saving ? 'Kaydediliyor ve çevriliyor…' : 'Kaydet ve Çevir'} variant="save" />
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
