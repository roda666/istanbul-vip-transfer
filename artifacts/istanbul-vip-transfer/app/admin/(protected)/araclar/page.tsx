import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import AraclarList from './_AraclarList';

export const metadata: Metadata = {
  title: 'Araçlar | Admin',
  robots: { index: false },
};

export default function AraclarPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Araçlar"
        description="Araç filonuzu yönetin"
        action={
          <Link
            href="/admin/araclar/yeni"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#C9A84C',
              color: '#0A0A0A',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Plus size={15} />
            Yeni Araç Ekle
          </Link>
        }
      />
      <AraclarList />
    </div>
  );
}
