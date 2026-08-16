import type { Metadata } from 'next';
import PersonelClient from './_PersonelClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Personel Yönetimi | Admin',
  robots: { index: false },
};

export default function PersonelPage() {
  return <PersonelClient />;
}
