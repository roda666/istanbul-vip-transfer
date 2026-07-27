import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import ContentForm from '../../../_components/ContentForm';

export const metadata: Metadata = { title: 'Yeni Hizmet | Admin', robots: { index: false } };

export default function YeniHizmetPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/hizmetler" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> Hizmetlere Dön
      </Link>
      <AdminPageHeader title="Yeni Hizmet" description="Yeni bir hizmet sayfası oluşturun" />
      <ContentForm mode="create" contentType="SERVICE" backUrl="/admin/hizmetler" />
    </div>
  );
}
