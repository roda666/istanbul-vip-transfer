import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import ContentForm from '../../../_components/ContentForm';

export const metadata: Metadata = { title: 'Yeni Blog Yazısı | Admin', robots: { index: false } };

export default function YeniBlogPage() {
  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> Blog&apos;a Dön
      </Link>
      <AdminPageHeader title="Yeni Blog Yazısı" description="Yeni bir blog yazısı oluşturun" />
      <ContentForm mode="create" contentType="BLOG_POST" backUrl="/admin/blog" />
    </div>
  );
}
