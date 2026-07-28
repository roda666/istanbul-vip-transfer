import type { Metadata } from 'next';
import ReservasyonAyarlariClient from './_ReservasyonAyarlariClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rezervasyon Ayarları | Admin',
  robots: { index: false },
};

export default function ReservasyonAyarlariPage() {
  return <ReservasyonAyarlariClient />;
}
