'use client';

import { useState, useEffect } from 'react';
import {
  Save, Loader2, CheckCircle, AlertTriangle, Wifi, WifiOff,
  Send, Eye, EyeOff, Info,
} from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

// ── Styles ─────────────────────────────────────────────────────────────────
const PAGE_BG   = '#F3F6FA';
const CARD_BG   = '#FFFFFF';
const BORDER    = '#D8E1E9';
const LABEL_C   = '#52697A';
const TEXT_C    = '#172B3A';
const MUTED_C   = '#8899AA';
const GOLD      = '#C99A32';
const DANGER    = '#C0392B';
const SUCCESS   = '#1A7A4A';

const s: Record<string, React.CSSProperties> = {
  page:    { background: PAGE_BG, minHeight: '100vh', padding: '0 0 48px' },
  content: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px' },
  card:    { background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' },
  sectionTitle: {
    fontSize: '13px', fontWeight: 700, color: LABEL_C,
    letterSpacing: '0.07em', textTransform: 'uppercase' as const,
    marginBottom: '16px', paddingBottom: '10px', borderBottom: `1px solid ${BORDER}`,
    fontFamily: 'Inter, sans-serif',
  },
  label:   { display: 'block', color: LABEL_C, fontSize: '11px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: '6px', fontWeight: 600 },
  input:   { width: '100%', padding: '9px 12px', background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT_C, fontSize: '16px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' as const },
  select:  { width: '100%', padding: '9px 12px', background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT_C, fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' as const, cursor: 'pointer' },
  row2:    { display: 'grid', gap: '12px', gridTemplateColumns: '1fr 1fr', marginBottom: '14px' },
  row1:    { marginBottom: '14px' },
  btn:     { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: 'none', transition: 'opacity .15s' },
  btnPrimary: { background: GOLD, color: '#fff' },
  btnGhost:   { background: '#F3F6FA', color: TEXT_C, border: `1px solid ${BORDER}` },
  btnDanger:  { background: '#FEF0EE', color: DANGER, border: `1px solid #F5C6C0` },
  btnSuccess: { background: '#EDF9F3', color: SUCCESS, border: `1px solid #A8DEC0` },
  badge:   { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif' },
  msg:     { padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginTop: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' },
};

const PROVIDER_PRESETS: Record<string, { host: string; port: number; secure: string }> = {
  gmail:    { host: 'smtp.gmail.com',     port: 587, secure: 'tls' },
  sendgrid: { host: 'smtp.sendgrid.net',  port: 587, secure: 'tls' },
  mailgun:  { host: 'smtp.mailgun.org',   port: 587, secure: 'tls' },
  custom:   { host: '',                   port: 587, secure: 'tls' },
};

interface Settings {
  encryptionReady: boolean;
  enabled: boolean;
  providerType: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: string;
  smtpUser: string;
  passwordSet: boolean;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  adminNotifyEmails: string;
}

const DEFAULTS: Settings = {
  encryptionReady: false,
  enabled: false,
  providerType: 'custom',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: 'tls',
  smtpUser: '',
  passwordSet: false,
  fromName: '',
  fromEmail: '',
  replyToEmail: '',
  adminNotifyEmails: '',
};

export default function EmailSettingsClient() {
  const [cfg, setCfg]           = useState<Settings>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  // Password field state
  const [passMode, setPassMode]       = useState<'keep' | 'change'>('keep');
  const [newPass, setNewPass]         = useState('');
  const [showPass, setShowPass]       = useState(false);

  // Test connection
  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult]   = useState<{ ok: boolean; text: string } | null>(null);

  // Test send
  const [sendTo, setSendTo]           = useState('');
  const [sending, setSending]         = useState(false);
  const [sendResult, setSendResult]   = useState<{ ok: boolean; text: string } | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/admin/api/email-settings')
      .then(r => r.json())
      .then((d: Settings) => {
        setCfg({
          encryptionReady:   d.encryptionReady   ?? false,
          enabled:           d.enabled           ?? false,
          providerType:      d.providerType      ?? 'custom',
          smtpHost:          d.smtpHost          ?? '',
          smtpPort:          d.smtpPort          ?? 587,
          smtpSecure:        d.smtpSecure        ?? 'tls',
          smtpUser:          d.smtpUser          ?? '',
          passwordSet:       d.passwordSet       ?? false,
          fromName:          d.fromName          ?? '',
          fromEmail:         d.fromEmail         ?? '',
          replyToEmail:      d.replyToEmail      ?? '',
          adminNotifyEmails: d.adminNotifyEmails ?? '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function field(k: keyof Settings) {
    return {
      value: String(cfg[k] ?? ''),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setCfg(prev => ({ ...prev, [k]: k === 'smtpPort' ? parseInt(e.target.value, 10) || 587 : e.target.value })),
    };
  }

  function handleProviderChange(v: string) {
    const preset = PROVIDER_PRESETS[v] ?? PROVIDER_PRESETS.custom;
    setCfg(prev => ({
      ...prev,
      providerType: v,
      ...(v !== 'custom' ? { smtpHost: preset.host, smtpPort: preset.port, smtpSecure: preset.secure } : {}),
    }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveMsg(null);

    const body: Record<string, unknown> = {
      enabled:           cfg.enabled,
      providerType:      cfg.providerType,
      smtpHost:          cfg.smtpHost   || null,
      smtpPort:          cfg.smtpPort,
      smtpSecure:        cfg.smtpSecure,
      smtpUser:          cfg.smtpUser   || null,
      fromName:          cfg.fromName   || null,
      fromEmail:         cfg.fromEmail  || null,
      replyToEmail:      cfg.replyToEmail || null,
      adminNotifyEmails: cfg.adminNotifyEmails || null,
    };
    if (passMode === 'change' && newPass.trim()) {
      body.smtpPass = newPass.trim();
    }

    try {
      const res  = await fetch('/admin/api/email-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setSaveMsg({ ok: false, text: data.error ?? 'Kaydedilemedi.' });
      } else {
        setSaveMsg({ ok: true, text: 'Ayarlar kaydedildi.' });
        setCfg(prev => ({ ...prev, passwordSet: passMode === 'change' ? !!newPass.trim() : prev.passwordSet }));
        if (passMode === 'change') { setPassMode('keep'); setNewPass(''); }
        setTimeout(() => setSaveMsg(null), 4000);
      }
    } catch {
      setSaveMsg({ ok: false, text: 'Sunucu hatası.' });
    } finally {
      setSaving(false);
    }
  }

  // ── Test Connection ───────────────────────────────────────────────────────
  async function handleTestConn() {
    setConnTesting(true); setConnResult(null);
    try {
      const res  = await fetch('/admin/api/email-settings/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string };
      setConnResult({ ok: res.ok, text: (res.ok ? data.message : data.error) ?? (res.ok ? 'Bağlantı başarılı.' : 'Bağlantı başarısız.') });
    } catch {
      setConnResult({ ok: false, text: 'Sunucu hatası.' });
    } finally {
      setConnTesting(false);
    }
  }

  // ── Test Send ─────────────────────────────────────────────────────────────
  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sendTo.trim()) return;
    setSending(true); setSendResult(null);
    try {
      const res  = await fetch('/admin/api/email-settings/test-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: sendTo.trim() }),
      });
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string };
      setSendResult({ ok: res.ok, text: (res.ok ? data.message : data.error) ?? (res.ok ? 'Gönderildi.' : 'Gönderilemedi.') });
    } catch {
      setSendResult({ ok: false, text: 'Sunucu hatası.' });
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.page}>
        <AdminPageHeader title="E-posta Ayarları" description="SMTP yapılandırması ve bildirim adresleri" />
        <div style={{ ...s.content, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: MUTED_C }} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <AdminPageHeader title="E-posta Ayarları" description="SMTP yapılandırması ve bildirim adresleri" />

      {/* ── Encryption key warning ───────────────────────────────────────── */}
      {!cfg.encryptionReady && (
        <div style={{ ...s.content, paddingBottom: 0 }}>
          <div style={{ ...s.msg, background: '#FEF9EC', border: '1px solid #F5D97A', color: '#7A5800' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Şifreleme anahtarı eksik</strong> — SMTP parolası şifreli olarak saklanamaz.
              <br />
              Replit Secrets bölümüne <code style={{ background: '#FFF3C4', padding: '1px 5px', borderRadius: '3px', fontSize: '12px' }}>EMAIL_ENCRYPTION_KEY</code> adlı bir secret ekleyin:
              <br />
              <code style={{ display: 'block', marginTop: '6px', background: '#FFF3C4', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all' }}>
                openssl rand -hex 32
              </code>
              Diğer ayarlar parola olmadan kaydedilebilir.
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div style={s.content}>

          {/* ── Enable toggle ────────────────────────────────────────────── */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: TEXT_C, fontFamily: 'Inter, sans-serif' }}>
                  E-posta bildirimleri
                </div>
                <div style={{ fontSize: '13px', color: MUTED_C, fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                  Kapalıyken uygulama hata vermeden çalışmaya devam eder.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', color: cfg.enabled ? SUCCESS : MUTED_C, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  {cfg.enabled ? 'Etkin' : 'Pasif'}
                </span>
                <div
                  onClick={() => setCfg(p => ({ ...p, enabled: !p.enabled }))}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px',
                    background: cfg.enabled ? SUCCESS : BORDER,
                    position: 'relative', cursor: 'pointer', transition: 'background .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: cfg.enabled ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </label>
            </div>
          </div>

          {/* ── Provider & Server ─────────────────────────────────────────── */}
          <div style={s.card}>
            <div style={s.sectionTitle}>SMTP Sunucu</div>

            {/* Provider type */}
            <div style={s.row1}>
              <label style={s.label}>Sağlayıcı</label>
              <select
                style={s.select}
                value={cfg.providerType}
                onChange={e => handleProviderChange(e.target.value)}
              >
                <option value="gmail">Gmail (smtp.gmail.com)</option>
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
                <option value="custom">Özel SMTP</option>
              </select>
              {cfg.providerType === 'gmail' && (
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <Info size={13} style={{ color: MUTED_C, flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '12px', color: MUTED_C, fontFamily: 'Inter, sans-serif' }}>
                    Gmail için uygulama şifresi gereklidir. Google Hesabı → Güvenlik → 2 adımlı doğrulama → Uygulama şifreleri.
                  </span>
                </div>
              )}
            </div>

            {/* Host + Port */}
            <div style={{ ...s.row2, gridTemplateColumns: '2fr 1fr' }}>
              <div>
                <label style={s.label}>Sunucu Adresi</label>
                <input
                  style={{ ...s.input, fontSize: '16px' }}
                  type="text"
                  placeholder="smtp.example.com"
                  autoComplete="off"
                  {...field('smtpHost')}
                />
              </div>
              <div>
                <label style={s.label}>Port</label>
                <input
                  style={{ ...s.input, fontSize: '16px' }}
                  type="number"
                  min={1} max={65535}
                  value={cfg.smtpPort}
                  onChange={e => setCfg(p => ({ ...p, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                />
              </div>
            </div>

            {/* Security */}
            <div style={s.row1}>
              <label style={s.label}>Güvenlik</label>
              <select style={s.select} value={cfg.smtpSecure} onChange={e => setCfg(p => ({ ...p, smtpSecure: e.target.value }))}>
                <option value="tls">TLS / STARTTLS (port 587 — önerilen)</option>
                <option value="ssl">SSL (port 465)</option>
                <option value="none">Şifresiz (yalnızca yerel test)</option>
              </select>
            </div>
          </div>

          {/* ── Auth ──────────────────────────────────────────────────────── */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Kimlik Doğrulama</div>

            <div style={s.row1}>
              <label style={s.label}>Kullanıcı Adı / E-posta</label>
              <input
                style={{ ...s.input, fontSize: '16px' }}
                type="email"
                placeholder="user@example.com"
                autoComplete="username"
                {...field('smtpUser')}
              />
            </div>

            {/* Password — never pre-filled */}
            <div style={s.row1}>
              <label style={s.label}>
                Parola
                {cfg.passwordSet && passMode === 'keep' && (
                  <span style={{ ...s.badge, background: '#EDF9F3', color: SUCCESS, marginLeft: '8px' }}>
                    <CheckCircle size={10} /> kayıtlı
                  </span>
                )}
              </label>

              {passMode === 'keep' ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{
                    flex: 1, minWidth: '120px', padding: '9px 12px', background: '#F8FAFB',
                    border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED_C,
                    fontSize: '13px', fontFamily: 'Inter, sans-serif',
                  }}>
                    {cfg.passwordSet ? '••••••••' : 'Parola girilmemiş'}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPassMode('change'); setNewPass(''); }}
                    style={{ ...s.btn, ...s.btnGhost, fontSize: '12px', padding: '9px 14px' }}
                  >
                    {cfg.passwordSet ? 'Değiştir' : 'Ekle'}
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...s.input, paddingRight: '42px', fontSize: '16px' }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Yeni parola"
                    autoComplete="new-password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: MUTED_C, padding: '4px' }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => { setPassMode('keep'); setNewPass(''); setShowPass(false); }}
                      style={{ ...s.btn, ...s.btnGhost, fontSize: '12px', padding: '6px 12px' }}>
                      İptal
                    </button>
                    {!cfg.encryptionReady && (
                      <span style={{ fontSize: '12px', color: DANGER, fontFamily: 'Inter, sans-serif', alignSelf: 'center' }}>
                        Şifreleme anahtarı eksik — parola kaydedilemez.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Email Addresses ───────────────────────────────────────────── */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Adres Ayarları</div>

            <div style={s.row2}>
              <div>
                <label style={s.label}>Gönderen Görünen Adı</label>
                <input style={{ ...s.input, fontSize: '16px' }} type="text" placeholder="VIP Transfer Istanbul" {...field('fromName')} />
              </div>
              <div>
                <label style={s.label}>Gönderen E-posta</label>
                <input style={{ ...s.input, fontSize: '16px' }} type="email" placeholder="noreply@example.com" {...field('fromEmail')} />
              </div>
            </div>

            <div style={s.row1}>
              <label style={s.label}>Yanıt Adresi (Reply-To)</label>
              <input style={{ ...s.input, fontSize: '16px' }} type="email" placeholder="info@example.com" {...field('replyToEmail')} />
            </div>

            <div style={s.row1}>
              <label style={s.label}>
                Yönetici Bildirim Adresleri
                <span style={{ color: MUTED_C, fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>(virgülle ayırın)</span>
              </label>
              <input
                style={{ ...s.input, fontSize: '16px' }}
                type="text"
                placeholder="admin@example.com, backup@example.com"
                value={cfg.adminNotifyEmails}
                onChange={e => setCfg(p => ({ ...p, adminNotifyEmails: e.target.value }))}
              />
              <div style={{ marginTop: '5px', fontSize: '12px', color: MUTED_C, fontFamily: 'Inter, sans-serif' }}>
                Sağlık uyarıları ve sistem bildirimleri bu adreslere gönderilir.
              </div>
            </div>
          </div>

          {/* ── Save button & feedback ────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ ...s.btn, ...s.btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>

          {saveMsg && (
            <div style={{
              ...s.msg,
              background: saveMsg.ok ? '#EDF9F3' : '#FEF0EE',
              border: `1px solid ${saveMsg.ok ? '#A8DEC0' : '#F5C6C0'}`,
              color: saveMsg.ok ? SUCCESS : DANGER,
            }}>
              {saveMsg.ok ? <CheckCircle size={15} style={{ flexShrink: 0 }} /> : <AlertTriangle size={15} style={{ flexShrink: 0 }} />}
              {saveMsg.text}
            </div>
          )}

          {/* ── Test Tools ────────────────────────────────────────────────── */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Test Araçları</div>

            {/* Test Connection */}
            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TEXT_C, fontFamily: 'Inter, sans-serif', marginBottom: '6px' }}>
                Bağlantıyı Test Et
              </div>
              <div style={{ fontSize: '13px', color: MUTED_C, fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
                Kayıtlı ayarlarla SMTP sunucusuna bağlantıyı doğrular. E-posta gönderilmez.
              </div>
              <button
                type="button"
                onClick={handleTestConn}
                disabled={connTesting}
                style={{ ...s.btn, ...s.btnGhost, opacity: connTesting ? 0.7 : 1 }}
              >
                {connTesting ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                {connTesting ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
              </button>
              {connResult && (
                <div style={{
                  ...s.msg,
                  background: connResult.ok ? '#EDF9F3' : '#FEF0EE',
                  border: `1px solid ${connResult.ok ? '#A8DEC0' : '#F5C6C0'}`,
                  color: connResult.ok ? SUCCESS : DANGER,
                }}>
                  {connResult.ok ? <Wifi size={14} style={{ flexShrink: 0 }} /> : <WifiOff size={14} style={{ flexShrink: 0 }} />}
                  {connResult.text}
                </div>
              )}
            </div>

            {/* Test Send */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TEXT_C, fontFamily: 'Inter, sans-serif', marginBottom: '6px' }}>
                Test E-postası Gönder
              </div>
              <div style={{ fontSize: '13px', color: MUTED_C, fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
                Yalnızca aşağıdaki adrese tek bir test mesajı gönderilir.
              </div>
              <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input
                  style={{ ...s.input, flex: '1 1 200px', minWidth: '200px', fontSize: '16px' }}
                  type="email"
                  placeholder="alici@example.com"
                  value={sendTo}
                  onChange={e => setSendTo(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={sending || !sendTo.trim()}
                  style={{ ...s.btn, ...s.btnGhost, opacity: (sending || !sendTo.trim()) ? 0.6 : 1, whiteSpace: 'nowrap' }}
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'Gönderiliyor…' : 'Test Gönder'}
                </button>
              </form>
              {sendResult && (
                <div style={{
                  ...s.msg,
                  background: sendResult.ok ? '#EDF9F3' : '#FEF0EE',
                  border: `1px solid ${sendResult.ok ? '#A8DEC0' : '#F5C6C0'}`,
                  color: sendResult.ok ? SUCCESS : DANGER,
                }}>
                  {sendResult.ok ? <CheckCircle size={14} style={{ flexShrink: 0 }} /> : <AlertTriangle size={14} style={{ flexShrink: 0 }} />}
                  {sendResult.text}
                </div>
              )}
            </div>
          </div>

        </div>
      </form>

      {/* Responsive grid collapse */}
      <style>{`
        @media (max-width: 600px) {
          .email-row2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
