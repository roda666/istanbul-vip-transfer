'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Shield } from 'lucide-react';

interface Props {
  searchParams: Promise<{ error?: string; changed?: string }>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  paddingTop: '10px',
  paddingBottom: '10px',
  paddingRight: '12px',
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '8px',
  color: '#172B3A',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function LoginForm({ searchParams }: Props) {
  const params = use(searchParams);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    params.error === 'misconfigured'
      ? 'Sunucu yapılandırma hatası: AUTH_SECRET ayarlanmamış. ADMIN_SETUP.md dosyasına bakın.'
      : '',
  );
  const passwordChanged = params.changed === '1';
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
        return;
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F3F6FA',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: '#132A44',
              marginBottom: '16px',
            }}
          >
            <Shield size={24} style={{ color: '#C99A32' }} />
          </div>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              color: '#132A44',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            VIP Transfer
          </h1>
          <p
            style={{
              color: '#718596',
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginTop: '4px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Admin Paneli
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #D8E1E9',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 4px 24px rgba(19,42,68,0.08)',
          }}
        >
          <h2
            style={{
              color: '#172B3A',
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Giriş Yap
          </h2>
          <p style={{ color: '#718596', fontSize: '14px', marginBottom: '28px', fontFamily: 'Inter, sans-serif' }}>
            Admin hesabınızla oturum açın.
          </p>

          {passwordChanged && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
              }}
            >
              <p style={{ color: '#168C5B', fontSize: '13px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                ✓ Şifreniz başarıyla değiştirildi. Lütfen yeni şifrenizle giriş yapın.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={16} style={{ color: '#D64545', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ color: '#D64545', fontSize: '13px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 600 }}
              >
                E-Posta
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#A0B0BC' }}
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@example.com"
                  style={{ ...inputStyle, paddingLeft: '40px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 600 }}
              >
                Şifre
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#A0B0BC' }}
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingLeft: '40px', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#A0B0BC',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: loading ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.05em',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#A0B0BC', fontSize: '12px', marginTop: '24px', fontFamily: 'Inter, sans-serif' }}>
          Kayıt sistemi kapalıdır. Yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
