import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/lib/auth/session';
import TurnstileSettingsClient from './turnstile-settings-client';

export const dynamic = 'force-dynamic';

export default async function GuvenlikAyarlariPage() {
  try {
    const session = await requireAdminSession();
    if (session.role !== 'SUPER_ADMIN') {
      return <p style={{ padding: '48px 24px', color: '#C0392B' }}>Bu sayfaya erişim yetkiniz bulunmuyor.</p>;
    }
  } catch {
    redirect('/admin');
  }
  return <TurnstileSettingsClient />;
}