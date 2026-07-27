import type { Metadata } from 'next';
import LoginForm from './_LoginForm';

export const metadata: Metadata = {
  title: 'Admin Girişi | İstanbul VIP Transfer',
  robots: { index: false, follow: false, noarchive: true },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}
