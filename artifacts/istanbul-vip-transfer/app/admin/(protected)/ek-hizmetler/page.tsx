import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import OptionalServicesClient from './_OptionalServicesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ek Hizmetler | Admin',
  robots: { index: false },
};

export default function OptionalServicesPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Ek Hizmetler"
        description="Transfer tekliflerinde kullanılacak ücretli ek hizmet kataloğu"
        action={null}
      />
      <OptionalServicesClient />
    </div>
  );
}