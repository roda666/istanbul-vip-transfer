import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import AbonelerClient from './_AbonelerClient';

export const metadata: Metadata = {
  title: 'Bülten Aboneleri | Admin',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function BultenAboneleriPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Bülten Aboneleri"
        description="Açık rıza vermiş e-posta abonelerini yönetin"
      />
      <AbonelerClient />
    </div>
  );
}
