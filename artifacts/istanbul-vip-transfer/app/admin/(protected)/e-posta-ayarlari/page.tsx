import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/lib/auth/session';
import EmailSettingsClient from './_EmailSettingsClient';

export const dynamic = 'force-dynamic';

export default async function EpostaAyarlariPage() {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect('/admin');
  }

  if (session.role !== 'SUPER_ADMIN') {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
      }}>
        <p style={{ color: '#C0392B', fontSize: '15px' }}>
          Bu sayfaya erişim yetkiniz bulunmuyor.
        </p>
        <p style={{ color: '#52697A', fontSize: '13px', marginTop: '8px' }}>
          Yalnızca Süper Yöneticiler e-posta ayarlarını görüntüleyebilir ve değiştirebilir.
        </p>
      </div>
    );
  }

  return <EmailSettingsClient />;
}
