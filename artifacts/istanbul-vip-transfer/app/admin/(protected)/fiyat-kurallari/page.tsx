import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import PriceRulesClient from './_PriceRulesClient';

export const metadata: Metadata = {
  title: 'Fiyat Kuralları | Admin',
  robots: { index: false },
};

export default function PriceRulesPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Fiyat Kuralları"
        description="Güzergah ve araç bazlı tahmini fiyat altyapısını yönetin"
        action={null}
      />
      <PriceRulesClient />
    </div>
  );
}