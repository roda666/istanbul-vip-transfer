'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '8px',
  color: '#172B3A',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);

  const isInvalidToken = !token || token.length < 32;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    if (password.length < 8)  { setError('Şifre en az 8 karakter olmalıdır.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Bir hata oluştu.'); return; }
      setSuccess(true);
      setTimeout(() => router.push('/admin/login?changed=1'), 2500);
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F1F35 0%, #1B2B4B 60%, #243757 100%)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', background: '#FFFFFF',
        borderRadius: '16px', padding: '40px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #1B2B4B 0%, #2D4A6E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <ShieldCheck size={28} color="#C9A84C" />
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>
            Yeni Şifre Belirle
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Admin paneli giriş şifrenizi güncelleyin
          </p>
        </div>

        {/* Invalid token */}
        {isInvalidToken && (
          <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: '#FFF5F5', border: '1px solid #FECACA', marginBottom: '20px' }}>
            <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '13px', color: '#DC2626', fontFamily: 'Inter, sans-serif' }}>
              Geçersiz veya eksik sıfırlama linki. Lütfen e-postanızdaki linki tam olarak kopyalayın veya yeni bir sıfırlama talebi gönderin.
            </p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: '20px' }}>
            <ShieldCheck size={16} color="#15803D" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '13px', color: '#15803D', fontFamily: 'Inter, sans-serif' }}>
              Şifreniz başarıyla güncellendi! Giriş sayfasına yönlendiriliyorsunuz…
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: '#FFF5F5', border: '1px solid #FECACA', marginBottom: '20px' }}>
            <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '13px', color: '#DC2626', fontFamily: 'Inter, sans-serif' }}>{error}</p>
          </div>
        )}

        {/* Form */}
        {!isInvalidToken && !success && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', fontFamily: 'Inter, sans-serif' }}>
                Yeni Şifre
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingLeft: '38px', paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', fontFamily: 'Inter, sans-serif' }}>
                Şifre Tekrar
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Şifreyi tekrar girin"
                  required
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingLeft: '38px', paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#94A3B8' : 'linear-gradient(135deg, #1B2B4B 0%, #2D4A6E 100%)',
                color: '#FFFFFF', fontSize: '14px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'opacity 0.2s', marginTop: '4px',
              }}
            >
              {loading ? 'Güncelleniyor…' : 'Şifremi Güncelle'}
            </button>
          </form>
        )}

        {/* Back to login */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/admin/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
            <ArrowLeft size={13} /> Giriş sayfasına dön
          </a>
        </div>
      </div>
    </div>
  );
}
