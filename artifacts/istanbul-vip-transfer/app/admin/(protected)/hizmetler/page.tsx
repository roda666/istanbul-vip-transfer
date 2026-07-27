import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/db';
import { content } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';
import ContentList from '../../_components/ContentList';

export const metadata: Metadata = { title: 'Hizmetler | Admin', robots: { index: false } };

export default async function HizmetlerPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let items: (typeof content.$inferSelect)[] = [];
  let total = 0;
  let dbError = false;

  try {
    const [rows, totalRows] = await Promise.all([
      db.select().from(content).where(eq(content.contentType, 'SERVICE')).orderBy(desc(content.updatedAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(content).where(eq(content.contentType, 'SERVICE')),
    ]);
    items = rows; total = totalRows[0]?.count ?? 0;
  } catch { dbError = true; }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Hizmetler"
        description="Hizmet sayfalarını yönetin"
        action={<Link href="/admin/hizmetler/yeni" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#C9A84C', color: '#0A0A0A', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}><Plus size={15} /> Yeni Hizmet</Link>}
      />
      {dbError ? <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Veritabanı bağlantı hatası.</p> : <ContentList items={items} baseUrl="/admin/hizmetler" page={page} total={total} limit={limit} />}
    </div>
  );
}
