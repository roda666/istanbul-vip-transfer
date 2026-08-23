import type { Metadata } from 'next';
import AdminPageHeader from '../../_components/AdminPageHeader';
import PricingWorkspace from './_PricingWorkspace';

export const metadata: Metadata = {
  title: 'Fiyat Kuralları | Admin',
  robots: { index: false },
};

export default function PriceRulesPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Fiyat Kuralları"
        description="Araç formüllerini, kur zincirini ve yönetici tekliflerini tek yerden yönetin"
        action={null}
      />
      <PricingWorkspace />
    </div>
  );
}