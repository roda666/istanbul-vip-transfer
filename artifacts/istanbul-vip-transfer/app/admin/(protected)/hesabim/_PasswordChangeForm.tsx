'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  paddingLeft: '40px',
  paddingRight: '44px',
  paddingTop: '10px',
  paddingBottom: '10px',
  background: '#0F0F0F',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          color: '#999',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.05em',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Lock
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#555',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordChangeForm() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (next !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (next === current) {
      setError('Yeni şifre mevcut şifreden farklı olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/admin/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Şifre değiştirilemedi. Lütfen tekrar deneyin.');
        return;
      }

      // Session destroyed server-side — redirect to login with success indicator
      router.push('/admin/login?changed=1');
    } catch {
      setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          <p style={{ color: '#f87171', fontSize: '13px', margin: 0, fontFamily: 'Inter, sans-serif' }}>
            {error}
          </p>
        </div>
      )}

      <PasswordField
        id="current-password"
        label="Mevcut Şifre"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-password"
        label="Yeni Şifre"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <PasswordField
        id="confirm-password"
        label="Yeni Şifre Tekrar"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <p style={{ color: '#555', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
        Minimum 8 karakter. Şifre değiştirildikten sonra oturumunuz kapatılır.
      </p>

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: '4px',
          padding: '11px',
          borderRadius: '8px',
          background: loading ? 'rgba(201,168,76,0.5)' : '#C9A84C',
          color: '#0A0A0A',
          fontWeight: 700,
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.05em',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {loading ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
            Değiştiriliyor…
          </>
        ) : (
          <>
            <CheckCircle size={16} aria-hidden="true" />
            Şifreyi Değiştir
          </>
        )}
      </button>
    </form>
  );
}
