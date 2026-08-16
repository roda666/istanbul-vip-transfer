import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import TransferRotalariList from './_TransferRotalariList';

export const metadata: Metadata = {
  title: 'Transfer Rotaları | Admin',
  robots: { index: false },
};

export default function TransferRotalariPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Transfer Rotaları"
        description="Ana sayfada görünen popüler güzergahları yönetin"
        action={null}
      />
      <div
        style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '24px',
          color: '#1D4ED8',
          fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <MapPin size={14} />
        Güzergah eklemek/düzenlemek için tablodaki satırlara tıklayın veya sağ taraftaki &quot;Düzenle&quot; butonunu kullanın. Sıralamayı değiştirmek için sıra numarasını güncelleyin.
      </div>
      <TransferRotalariList />
    </div>
  );
}
