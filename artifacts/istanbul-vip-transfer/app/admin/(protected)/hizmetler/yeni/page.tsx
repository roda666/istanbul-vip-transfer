import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import CreateServicePageForm from '../_CreateServicePageForm';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';

export const metadata: Metadata = { title: 'Yeni Hizmet | Admin', robots: { index: false } };

interface Props {
  searchParams: Promise<{ slug?: string; title?: string }>;
}

export default async function YeniHizmetPage({ searchParams }: Props) {
  const catalog = await getPublicServiceCatalog('tr');
  const { slug, title } = await searchParams;
  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/hizmetler" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> Hizmetlere Dön
      </Link>
      <AdminPageHeader title="Yeni Hizmet" description="Yeni bir hizmet sayfası oluşturun" />
      <CreateServicePageForm categories={catalog.categories} initialSlug={slug} initialTitle={title} />
    </div>
  );
}
