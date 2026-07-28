'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, Check, X, Star } from 'lucide-react';
import type { Language } from '@/db/schema';

const DIR_LABELS: Record<string, string> = { ltr: 'LTR', rtl: 'RTL (Arapça)' };
const STATUS_COLORS = {
  enabled: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  disabled: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  default: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
};

interface Props {
  langs: Language[];
}

export default function DillerClient({ langs: initialLangs }: Props) {
  const router = useRouter();
  const [langs, setLangs] = useState(initialLangs);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDefault, setConfirmDefault] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(lang: Language) {
    if (lang.code === 'tr') return; // Turkish is always the source
    setLoading(lang.id);
    setError(null);
    try {
      const res = await fetch(`/admin/api/languages/${lang.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !lang.isEnabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
      setLangs((prev) =>
        prev.map((l) => (l.id === lang.id ? { ...l, isEnabled: !l.isEnabled } : l)),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function setDefault(lang: Language) {
    setConfirmDefault(null);
    setLoading(lang.id);
    setError(null);
    try {
      const res = await fetch(`/admin/api/languages/${lang.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
      setLangs((prev) => prev.map((l) => ({ ...l, isDefault: l.id === lang.id })));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const defaultLang = langs.find((l) => l.isDefault);

  return (
    <div>
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif' }}
        >
          {error}
        </div>
      )}

      {/* Info card */}
      <div
        className="mb-6 p-4 rounded-xl text-sm"
        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontFamily: 'Inter, sans-serif' }}
      >
        <strong>Bilgi:</strong> Türkçe kaynak dildir ve her zaman aktiftir. Diğer diller için çeviriler{' '}
        <Link href="/admin/ceviriler" style={{ color: '#1D4ED8', textDecoration: 'underline' }}>Çeviriler</Link> sayfasından yönetilir.
        Şu anda varsayılan dil: <strong>{defaultLang?.nativeName ?? 'Türkçe'}</strong>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDF3' }}>
              {['Dil', 'Kod', 'Yerel Ad', 'Yön', 'Durum', 'İşlemler'].map((h) => (
                <th
                  key={h}
                  style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60758A', fontWeight: 600 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {langs.map((lang, i) => {
              const isLast = i === langs.length - 1;
              const isTr = lang.code === 'tr';
              return (
                <tr
                  key={lang.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #F1F4F8',
                    background: loading === lang.id ? '#FAFBFC' : '#FFFFFF',
                    opacity: loading === lang.id ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={14} style={{ color: '#C99A32', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, fontSize: '13px', color: '#1A2B3C' }}>{lang.nativeName}</span>
                      {lang.isDefault && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: STATUS_COLORS.default.bg, color: STATUS_COLORS.default.text, border: `1px solid ${STATUS_COLORS.default.border}` }}
                        >
                          Varsayılan
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8899AA', marginTop: '2px' }}>{lang.name}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                      {lang.code}
                    </code>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px', color: '#263F55', fontFamily: lang.direction === 'rtl' ? 'Arial, sans-serif' : undefined }}>
                    {lang.nativeName}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
                        background: lang.direction === 'rtl' ? '#FEF9C3' : '#F0FDF4',
                        color: lang.direction === 'rtl' ? '#854D0E' : '#166534',
                        border: `1px solid ${lang.direction === 'rtl' ? '#FDE68A' : '#BBF7D0'}`,
                      }}
                    >
                      {DIR_LABELS[lang.direction] ?? lang.direction}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {isTr ? (
                      <span style={{ fontSize: '11px', color: '#50677A', fontStyle: 'italic' }}>Kaynak dil</span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
                          background: lang.isEnabled ? STATUS_COLORS.enabled.bg : STATUS_COLORS.disabled.bg,
                          color: lang.isEnabled ? STATUS_COLORS.enabled.text : STATUS_COLORS.disabled.text,
                          border: `1px solid ${lang.isEnabled ? STATUS_COLORS.enabled.border : STATUS_COLORS.disabled.border}`,
                        }}
                      >
                        {lang.isEnabled ? 'Aktif' : 'Pasif'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isTr && (
                        <button
                          onClick={() => toggle(lang)}
                          disabled={loading === lang.id}
                          title={lang.isEnabled ? 'Devre dışı bırak' : 'Etkinleştir'}
                          style={{
                            padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                            background: lang.isEnabled ? '#FEF2F2' : '#ECFDF5',
                            color: lang.isEnabled ? '#991B1B' : '#065F46',
                          }}
                        >
                          {lang.isEnabled ? <X size={11} /> : <Check size={11} />}
                          {lang.isEnabled ? 'Devre Dışı' : 'Etkinleştir'}
                        </button>
                      )}
                      {!lang.isDefault && !isTr && (
                        <button
                          onClick={() => setConfirmDefault(lang)}
                          disabled={loading === lang.id}
                          title="Varsayılan dil yap"
                          style={{
                            padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                            background: '#EFF6FF', color: '#1E40AF',
                          }}
                        >
                          <Star size={11} />
                          Varsayılan Yap
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm default dialog */}
      {confirmDefault && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{ background: '#FFF', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'Inter, sans-serif' }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2B3C', marginBottom: '12px' }}>
              Varsayılan Dili Değiştir
            </h3>
            <p style={{ fontSize: '13px', color: '#50677A', lineHeight: 1.6, marginBottom: '20px' }}>
              <strong>{confirmDefault.nativeName}</strong> dilini varsayılan yapmak istediğinizden emin misiniz?
              Bu işlem mevcut varsayılan dili sıfırlar.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDefault(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D9E2EC', background: '#FFF', cursor: 'pointer', fontSize: '13px' }}
              >
                İptal
              </button>
              <button
                onClick={() => setDefault(confirmDefault)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#FFF', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Evet, Değiştir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
