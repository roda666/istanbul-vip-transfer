import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { content } from '@/db/schema';
import { eq } from 'drizzle-orm';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import ContentForm from '../../../_components/ContentForm';

export const metadata: Metadata = { title: 'Hizmeti Düzenle | Admin', robots: { index: false } };

export default async function EditHizmetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: typeof content.$inferSelect | undefined;
  try {
    const rows = await db.select().from(content).where(eq(content.id, id)).limit(1);
    item = rows[0];
  } catch {
    return <div style={{ padding: '28px 24px', color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Veritabanı bağlantı hatası.</div>;
  }
  if (!item || item.contentType !== 'SERVICE') notFound();
  const dto = { ...item, approvedAt: item.approvedAt?.toISOString() ?? null, scheduledAt: item.scheduledAt?.toISOString() ?? null, publishedAt: item.publishedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
  return (
    <div style={{ padding: '28px 24px' }}>
      <Link href="/admin/hizmetler" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}><ArrowLeft size={14} /> Hizmetlere Dön</Link>
      <AdminPageHeader title="Hizmeti Düzenle" description={item.title} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ContentForm mode="edit" contentType="SERVICE" initialData={dto as any} backUrl="/admin/hizmetler" />
    </div>
  );
}
