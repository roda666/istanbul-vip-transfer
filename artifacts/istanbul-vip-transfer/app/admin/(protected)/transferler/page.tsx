import AdminPageHeader from '../../_components/AdminPageHeader';
import TransfersClient from './_TransfersClient';
export const dynamic = 'force-dynamic';
export default function TransfersPage() {
  return <div style={{ padding: '28px 24px' }}><AdminPageHeader title="Transfer Operasyonları" description="Planlanan alışlar, atamalar ve operasyon durumu" /><TransfersClient /></div>;
}