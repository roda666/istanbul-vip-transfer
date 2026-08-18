import AdminPageHeader from '../../_components/AdminPageHeader';
import IstatistiklerClient from './_IstatistiklerClient';

export const dynamic = 'force-dynamic';

export default function IstatistiklerPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="İstatistikler"
        description="Son 30 günlük rezervasyon ve abone verileri — canlı veritabanından"
      />
      <IstatistiklerClient />
    </div>
  );
}
