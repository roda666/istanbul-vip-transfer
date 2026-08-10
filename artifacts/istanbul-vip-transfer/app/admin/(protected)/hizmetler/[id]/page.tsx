import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getServicePageAdminRecord } from '@/lib/service-page-cms';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import ServicePageEditor from '../_ServicePageEditor';

export const metadata: Metadata = { title: 'Hizmeti Düzenle | Admin', robots: { index: false } };

interface Props { params: Promise<{ id: string }> }

export default async function EditHizmetPage({ params }: Props) {
  const { id } = await params;

  let record;
  try {
    record = await getServicePageAdminRecord(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'Not found') notFound();
    return (
      <div style={{ padding: '28px 24px', color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
        Veritabanı bağlantı hatası.
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/hizmetler" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif',
        textDecoration: 'none', marginBottom: '16px',
      }}>
        <ArrowLeft size={14} /> Hizmetlere Dön
      </Link>
      <AdminPageHeader title="Hizmeti Düzenle" description={record.title} />
      <ServicePageEditor initialRecord={record} />
    </div>
  );
}
