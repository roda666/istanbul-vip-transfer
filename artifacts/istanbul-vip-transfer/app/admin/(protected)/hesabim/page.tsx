import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import PasswordChangeForm from './_PasswordChangeForm';

export const metadata: Metadata = {
  title: 'Hesabım | Admin',
  robots: { index: false, follow: false },
};

const labelStyle: React.CSSProperties = {
  color: '#718596',
  fontSize: '12px',
  fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.05em',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  color: '#172B3A',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
};

const sectionStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '24px',
};

const sectionHeadingStyle: React.CSSProperties = {
  color: '#52697A',
  fontSize: '11px',
  fontFamily: 'Inter, sans-serif',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  marginBottom: '20px',
  fontWeight: 600,
};

export default async function HesabimPage() {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();

  const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Süper Yönetici',
    ADMIN: 'Yönetici',
    EDITOR: 'Editör',
    CHAT_STAFF: 'Sohbet Personeli',
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: '560px' }}>
      <AdminPageHeader title="Hesabım" description="Profil bilgileriniz ve şifre yönetimi" />

      {/* Profile info */}
      <section style={sectionStyle} aria-label="Profil bilgileri">
        <h2 style={sectionHeadingStyle}>Profil</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={labelStyle}>Ad</p>
            <p style={valueStyle}>{session.name || '—'}</p>
          </div>
          <div>
            <p style={labelStyle}>E-Posta</p>
            <p style={{ ...valueStyle, color: '#52697A' }} aria-label="E-Posta (salt okunur)">
              {session.email || '—'}
            </p>
            <p style={{ color: '#A0B0BC', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '3px' }}>
              E-posta adresi değiştirilemez.
            </p>
          </div>
          <div>
            <p style={labelStyle}>Rol</p>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '4px',
                background: '#FFFBEB',
                color: '#C99A32',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.08em',
                border: '1px solid #FDE68A',
              }}
              aria-label="Rol (salt okunur)"
            >
              {ROLE_LABELS[session.role] ?? session.role}
            </span>
          </div>
        </div>
      </section>

      {/* Password change */}
      <section style={sectionStyle} aria-label="Şifre değiştir">
        <h2 style={sectionHeadingStyle}>Şifre Değiştir</h2>
        <PasswordChangeForm />
      </section>
    </div>
  );
}
