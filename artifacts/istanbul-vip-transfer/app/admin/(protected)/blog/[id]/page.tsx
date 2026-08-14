import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBlogAdminRecord } from '@/lib/blog-cms';
import BlogEditor from '../_BlogEditor';

export const metadata: Metadata = { title: 'Blog Yazısını Düzenle | Admin', robots: { index: false } };

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let record: Awaited<ReturnType<typeof getBlogAdminRecord>> | null = null;
  try {
    record = await getBlogAdminRecord(id);
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
    <div style={{ padding: '28px 24px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link
          href="/admin/blog"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} /> Blog
        </Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <span style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#1E293B', fontWeight: 600 }}>
          {record.title}
        </span>
      </div>

      <BlogEditor blogId={id} initial={record} />
    </div>
  );
}
