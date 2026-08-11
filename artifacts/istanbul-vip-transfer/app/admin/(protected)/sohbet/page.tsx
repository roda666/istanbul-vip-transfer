import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import SohbetClient from './_SohbetClient';

export const metadata: Metadata = {
  title: 'Sohbet | Admin',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function SohbetPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Canlı Sohbet"
        description="Ziyaretçilerle gerçek zamanlı sohbet — müşteri mesajları Türkçe gösterilir, yanıtlarınız otomatik çevrilir"
      />
      <SohbetClient />
    </div>
  );
}
