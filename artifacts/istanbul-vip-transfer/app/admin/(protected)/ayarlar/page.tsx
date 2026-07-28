'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

interface Settings {
  businessName?: string | null;
  logoPath?: string | null;
  phoneDisplay?: string | null;
  phoneInternational?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  googleBusinessUrl?: string | null;
  address?: string | null;
  defaultSeoTitle?: string | null;
  defaultSeoDescription?: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#FFFFFF',
  border: '1px solid #D8E1E9', borderRadius: '8px',
  color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600,
};

export default function AyarlarPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/admin/api/settings').then(r => r.json()).then(d => { setSettings(d.settings ?? {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess(false);
    try {
      const res = await fetch('/admin/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Kaydedilemedi.'); }
      else { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    } catch { setError('Sunucu hatası.'); }
    finally { setSaving(false); }
  }

  function field(key: keyof Settings) {
    return { value: settings[key] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSettings(s => ({ ...s, [key]: e.target.value || null })) };
  }

  if (loading) return <div style={{ padding: '28px 24px', color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader title="Site Ayarları" description="Genel site yapılandırması" />

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#168C5B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          <CheckCircle size={14} /> Ayarlar kaydedildi.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '640px' }}>
        {[
          { section: 'İşletme Bilgileri', fields: [
            { key: 'businessName' as keyof Settings, label: 'İşletme Adı' },
            { key: 'logoPath' as keyof Settings, label: 'Logo Yolu' },
          ]},
          { section: 'İletişim', fields: [
            { key: 'phoneDisplay' as keyof Settings, label: 'Telefon (Görünüm)' },
            { key: 'phoneInternational' as keyof Settings, label: 'Telefon (E.164)' },
            { key: 'whatsappNumber' as keyof Settings, label: 'WhatsApp Numarası' },
            { key: 'email' as keyof Settings, label: 'E-Posta' },
            { key: 'googleBusinessUrl' as keyof Settings, label: 'Google İşletme URL' },
            { key: 'address' as keyof Settings, label: 'Adres' },
          ]},
          { section: 'SEO Varsayılanları', fields: [
            { key: 'defaultSeoTitle' as keyof Settings, label: 'Varsayılan Meta Başlık' },
            { key: 'defaultSeoDescription' as keyof Settings, label: 'Varsayılan Meta Açıklama' },
          ]},
        ].map(section => (
          <div key={section.section} style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <p style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #EDF2F7', margin: '0 0 16px' }}>{section.section}</p>
            <div style={{ display: 'grid', gap: '12px' }}>
              {section.fields.map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  {f.key === 'address' || f.key === 'defaultSeoDescription' ? (
                    <textarea {...field(f.key)} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />
                  ) : (
                    <input type="text" {...field(f.key)} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', borderRadius: '8px', background: saving ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', fontFamily: 'Inter, sans-serif', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? <Loader2 size={14} /> : <Save size={14} />} {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
