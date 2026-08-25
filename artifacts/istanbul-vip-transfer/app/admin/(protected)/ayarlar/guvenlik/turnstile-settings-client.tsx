'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Save, ShieldCheck } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';

type Config = {
  encryptionReady: boolean;
  encryptionIssue: string | null;
  contactEnabled: boolean;
  reservationEnabled: boolean;
  siteKey: string | null;
  secretSet: boolean;
  configured: boolean;
};

const initialConfig: Config = {
  encryptionReady: false,
  encryptionIssue: null,
  contactEnabled: true,
  reservationEnabled: false,
  siteKey: null,
  secretSet: false,
  configured: false,
};

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #D8E1E9', fontSize: '15px', color: '#172B3A', background: '#FFFFFF',
};

function responseMessage(response: Response, data: { error?: unknown }, fallback: string): string {
  if (response.status === 401) return 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.';
  if (response.status === 403) return 'Bu ayarı değiştirmek için yeterli yetkiniz yok.';
  if (response.status === 429) return 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.';
  if (response.status === 503) return typeof data.error === 'string'
    ? data.error
    : 'Güvenli kaydetme hizmeti şu anda kullanılamıyor. Hiçbir gizli anahtar kaydedilmedi.';
  return typeof data.error === 'string' && data.error !== 'Forbidden'
    ? data.error
    : fallback;
}

export default function TurnstileSettingsClient() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/admin/api/turnstile-settings')
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!response.ok || data.error) {
          setMessage({ ok: false, text: responseMessage(response, data, 'Turnstile ayarları yüklenemedi.') });
          return;
        }
        setConfig({
          encryptionReady: data.encryptionReady ?? false,
          encryptionIssue: data.encryptionIssue ?? null,
          contactEnabled: data.contactEnabled ?? true,
          reservationEnabled: data.reservationEnabled ?? false,
          siteKey: data.siteKey ?? null,
          secretSet: data.secretSet ?? false,
          configured: data.configured ?? false,
        });
      })
      .catch(() => setMessage({ ok: false, text: 'Turnstile ayarları yüklenemedi.' }))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/admin/api/turnstile-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEnabled: config.contactEnabled,
          reservationEnabled: config.reservationEnabled,
          siteKey: config.siteKey?.trim() || null,
          secretKey: secretKey.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: responseMessage(response, data, 'Ayarlar kaydedilemedi.') });
        return;
      }
      setConfig((current) => ({
        ...current,
        encryptionReady: data.encryptionReady ?? current.encryptionReady,
          encryptionIssue: data.encryptionIssue ?? current.encryptionIssue,
        contactEnabled: data.contactEnabled ?? current.contactEnabled,
        reservationEnabled: data.reservationEnabled ?? current.reservationEnabled,
        siteKey: data.siteKey ?? null,
        secretSet: data.secretSet ?? current.secretSet,
        configured: data.configured ?? false,
      }));
      setSecretKey('');
      const details = [
        data.siteKeySaved ? 'site anahtarı' : null,
        data.secretKeySaved ? 'gizli anahtar' : null,
      ].filter(Boolean);
      setMessage({
        ok: true,
        text: details.length
          ? `Turnstile ayarları kaydedildi ve doğrulandı: ${details.join(' ve ')}.`
          : 'Turnstile ayarları kaydedildi.',
      });
    } catch {
      setMessage({ ok: false, text: 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '48px 24px', color: '#52697A', fontFamily: 'Inter, sans-serif' }}>Yükleniyor…</div>;
  }

  const warning = (config.contactEnabled || config.reservationEnabled) && !config.configured;
  return (
    <div style={{ background: '#F3F6FA', minHeight: '100vh', padding: '0 0 48px' }}>
      <AdminPageHeader title="Form Güvenliği" description="Cloudflare Turnstile bot koruması" />
      <form onSubmit={save} style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>
        {warning && (
          <div style={{ display: 'flex', gap: '10px', padding: '14px', marginBottom: '16px', borderRadius: '10px', border: '1px solid #F5D97A', background: '#FEF9EC', color: '#7A5800', fontSize: '13px', lineHeight: 1.5 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div><strong>Turnstile yapılandırılmamış</strong><br />Site anahtarı veya gizli anahtar eksik. İletişim formu, hız sınırı, tuzak alanları ve imzalı süre kontrolüyle çalışmaya devam eder.</div>
          </div>
        )}
        {!config.encryptionReady && (
          <div style={{ display: 'flex', gap: '10px', padding: '14px', marginBottom: '16px', borderRadius: '10px', border: '1px solid #F5C6C0', background: '#FEF0EE', color: '#C0392B', fontSize: '13px' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            {config.encryptionIssue === 'root_key_unavailable'
              ? 'Sunucunun ana şifreleme anahtarı hazır değil. Güvenlik nedeniyle gizli anahtar kaydedilemez.'
              : config.encryptionIssue === 'stored_key_invalid'
                ? 'Kayıtlı şifreleme anahtarı doğrulanamadı. Güvenlik nedeniyle gizli anahtar kaydedilemez.'
                : 'Gizli anahtarın güvenli saklama hizmeti şu anda kullanılamıyor. Güvenlik nedeniyle kaydetme reddedilir.'}
          </div>
        )}
        <section style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#172B3A', fontWeight: 700, fontSize: '16px' }}><ShieldCheck size={19} color="#1A7A4A" /> Cloudflare Turnstile</div>
              <p style={{ margin: '6px 0 0', color: '#52697A', fontSize: '13px', lineHeight: 1.5 }}>Managed widget seçili public formlarda insan doğrulaması sağlar.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '22px', padding: '14px', borderRadius: '9px', background: '#F8FAFC', border: '1px solid #E5EBF1' }}>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: config.contactEnabled ? '#1A7A4A' : '#52697A' }}>
              <input type="checkbox" checked={config.contactEnabled} onChange={(event) => setConfig((current) => ({ ...current, contactEnabled: event.target.checked }))} style={{ width: '18px', height: '18px', accentColor: '#1A7A4A' }} />
              İletişim formunda Turnstile {config.contactEnabled ? 'etkin' : 'pasif'}
            </label>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: config.reservationEnabled ? '#1A7A4A' : '#52697A' }}>
              <input type="checkbox" checked={config.reservationEnabled} onChange={(event) => setConfig((current) => ({ ...current, reservationEnabled: event.target.checked }))} style={{ width: '18px', height: '18px', accentColor: '#1A7A4A' }} />
              Rezervasyon formunda Turnstile {config.reservationEnabled ? 'etkin' : 'pasif'} (varsayılan: pasif)
            </label>
          </div>
          <div style={{ display: 'grid', gap: '16px' }}>
            <label>
              <span style={{ display: 'block', color: '#52697A', fontWeight: 700, fontSize: '11px', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '7px' }}>Site Anahtarı</span>
              <input value={config.siteKey ?? ''} onChange={(event) => setConfig((current) => ({ ...current, siteKey: event.target.value }))} placeholder="0x4AAAA..." autoComplete="off" style={input} />
              <span style={{ display: 'block', color: '#718596', fontSize: '12px', marginTop: '6px' }}>Bu anahtar widget tarafından kullanılır ve herkese açık olabilir.</span>
            </label>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#52697A', fontWeight: 700, fontSize: '11px', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '7px' }}>
                Gizli Anahtar
                {config.secretSet && <span style={{ color: '#1A7A4A', letterSpacing: 0, textTransform: 'none', fontSize: '11px' }}><CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> kayıtlı</span>}
              </span>
              <input type="password" value={secretKey} onChange={(event) => setSecretKey(event.target.value)} placeholder={config.secretSet ? '••••••••  Değiştirmek için yeni anahtar girin' : '0x4AAAA...'} autoComplete="new-password" style={input} />
              <span style={{ display: 'block', color: '#718596', fontSize: '12px', marginTop: '6px' }}>Gizli anahtar hiçbir zaman ekranda geri gösterilmez. Alanı boş bırakırsanız mevcut kayıt korunur.</span>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 18px', border: 0, borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', background: '#C99A32', color: '#FFFFFF', fontWeight: 700 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </section>
        {message && (
          <div role={message.ok ? 'status' : 'alert'} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${message.ok ? '#A8DEC0' : '#F5C6C0'}`, background: message.ok ? '#EDF9F3' : '#FEF0EE', color: message.ok ? '#1A7A4A' : '#C0392B', fontSize: '13px' }}>
            {message.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}