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
  // Legal / trust fields
  companyLegalName?: string | null;
  companyTradeName?: string | null;
  tursabNo?: string | null;
  fullAddress?: string | null;
  googlePlayUrl?: string | null;
  googleReviewUrl?: string | null;
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
const hintStyle: React.CSSProperties = {
  color: '#8FA3B3', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px',
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

        {/* Şirket Bilgileri */}
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #EDF2F7', margin: '0 0 16px' }}>İşletme Bilgileri</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>İşletme Adı (Görünüm)</label>
              <input type="text" {...field('businessName')} style={inputStyle} placeholder="Istanbul VIP Transfer" />
            </div>
            <div>
              <label style={labelStyle}>Logo Yolu</label>
              <input type="text" {...field('logoPath')} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Yasal / Güven Bilgileri */}
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: '#92400E', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px', margin: '0 0 4px' }}>Yasal &amp; Güven Bilgileri</p>
          <p style={{ color: '#B45309', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #FDE68A' }}>Footer ve yasal sayfalarda (KVKK, Gizlilik) gösterilir.</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Şirket Ticari Unvanı</label>
              <input type="text" {...field('companyLegalName')} style={inputStyle} placeholder="Hevra Turizm" />
              <p style={hintStyle}>Resmi tescilli şirket adı — KVKK ve yasal belgeler için kullanılır.</p>
            </div>
            <div>
              <label style={labelStyle}>Ticari Adı / Marka</label>
              <input type="text" {...field('companyTradeName')} style={inputStyle} placeholder="The History Travel" />
            </div>
            <div>
              <label style={labelStyle}>TÜRSAB Belge No</label>
              <input type="text" {...field('tursabNo')} style={inputStyle} placeholder="A-7377" />
              <p style={hintStyle}>Footer&apos;da güven rozeti olarak ve yasal sayfalarda gösterilir.</p>
            </div>
            <div>
              <label style={labelStyle}>Tam Açık Adres</label>
              <textarea {...field('fullAddress')} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} placeholder="Alemdar Mah. Ticarethane Sok. No:5/3 34110 Fatih/İSTANBUL" />
              <p style={hintStyle}>Footer iletişim bölümünde ve yasal sayfalarda görünür.</p>
            </div>
            <div>
              <label style={labelStyle}>Google Play URL (Opsiyonel)</label>
              <input type="url" {...field('googlePlayUrl')} style={inputStyle} placeholder="https://play.google.com/store/apps/details?id=..." />
              <p style={hintStyle}>Dolu ise footer&apos;da &ldquo;Mobil Uygulamayı İndir&rdquo; rozeti gösterilir.</p>
            </div>
          </div>
        </div>

        {/* İletişim */}
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #EDF2F7', margin: '0 0 16px' }}>İletişim</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { key: 'phoneDisplay' as keyof Settings, label: 'Telefon (Görünüm)', placeholder: '+90 532 660 08 47' },
              { key: 'phoneInternational' as keyof Settings, label: 'Telefon (E.164)', placeholder: '+905326600847' },
              { key: 'whatsappNumber' as keyof Settings, label: 'WhatsApp Numarası', placeholder: '905326600847' },
              { key: 'email' as keyof Settings, label: 'E-Posta', placeholder: 'info@istanbulviptransfer.com' },
              { key: 'googleBusinessUrl' as keyof Settings, label: 'Google İşletme URL', placeholder: 'https://maps.app.goo.gl/...' },
              { key: 'googleReviewUrl' as keyof Settings, label: 'Google Yorum URL (Direkt Link)', placeholder: 'https://g.page/r/xxx/review' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input type="text" {...field(f.key)} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Kısa Adres (Görünüm)</label>
              <textarea {...field('address')} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} placeholder="İstanbul, Türkiye" />
              <p style={hintStyle}>Kısa biçim — tam adres için yukarıdaki &quot;Tam Açık Adres&quot; alanını kullanın.</p>
            </div>
          </div>
        </div>

        {/* SEO */}
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #EDF2F7', margin: '0 0 16px' }}>SEO Varsayılanları</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Varsayılan Meta Başlık</label>
              <input type="text" {...field('defaultSeoTitle')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Varsayılan Meta Açıklama</label>
              <textarea {...field('defaultSeoDescription')} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 20px', borderRadius: '8px', background: saving ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', fontFamily: 'Inter, sans-serif', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? <Loader2 size={14} /> : <Save size={14} />} {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
