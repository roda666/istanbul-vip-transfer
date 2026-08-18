import type { Metadata } from 'next';
import ResetPasswordForm from './_ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Şifre Sıfırla — Admin',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ''} />;
}
