import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import TaleplerClient from './_TaleplerClient';

export const metadata: Metadata = {
  title: 'Talepler | Admin',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function TaleplerPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Talepler"
        description="Fiyat teklifi ve rezervasyon taleplerini yönetin"
      />
      <TaleplerClient />
    </div>
  );
}
