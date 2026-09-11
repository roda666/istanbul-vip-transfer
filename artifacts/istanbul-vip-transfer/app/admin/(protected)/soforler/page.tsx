import AdminPageHeader from '../../_components/AdminPageHeader';
import DriversClient from './_DriversClient';
export const dynamic = 'force-dynamic';
export default function DriversPage() { return <div style={{ padding: '28px 24px' }}><AdminPageHeader title="Sürücüler" description="Operasyon sürücüleri ve aktiflik durumu" /><DriversClient /></div>; }