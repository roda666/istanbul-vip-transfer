import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/db';
import { content } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import AdminPageHeader from '../../_components/AdminPageHeader';

export const metadata: Metadata = { title: 'Hizmetler | Admin', robots: { index: false } };

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Taslak',   color: '#9333EA', bg: '#FAF5FF' },
  PUBLISHED: { label: 'Yayında',  color: '#059669', bg: '#ECFDF5' },
  ARCHIVED:  { label: 'Arşiv',   color: '#64748B', bg: '#F1F5F9' },
};

export default async function HizmetlerPage() {
  let items: (typeof content.$inferSelect & { isActive: boolean; displayOrder: number })[] = [];
  let dbError = false;

  try {
    const rows = await db
      .select()
      .from(content)
      .where(eq(content.contentType, 'SERVICE'))
      .orderBy(asc(content.displayOrder), asc(content.createdAt));
    items = rows as typeof items;
  } catch { dbError = true; }

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader
        title="Hizmet Sayfaları"
        description="CMS ile tüm hizmet sayfalarını yönetin. Türkçe kaydedin — EN/DE/RU/AR otomatik çevrilir."
      />

      {dbError ? (
        <p style={{ color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Veritabanı bağlantı hatası.
        </p>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px 80px 80px 80px',
            gap: '12px', padding: '10px 20px', background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0', fontFamily: 'Inter, sans-serif' }}>
            {['#', 'Başlık', 'Slug', 'Sıra', 'Durum', 'İşlem'].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          {items.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8',
              fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
              Henüz hizmet sayfası eklenmemiş.
            </div>
          )}

          {items.map((item, idx) => {
            const s = STATUS_STYLE[item.status] ?? STATUS_STYLE.DRAFT;
            return (
              <div key={item.id} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 100px 80px 80px 80px',
                gap: '12px', padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
                alignItems: 'center', fontFamily: 'Inter, sans-serif',
                background: !item.isActive ? '#FAFAFA' : undefined,
              }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{idx + 1}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                    {item.title}
                    {!item.isActive && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>
                        (pasif)
                      </span>
                    )}
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B', wordBreak: 'break-all' }}>
                  /{item.slug.slice(0, 20)}{item.slug.length > 20 ? '…' : ''}
                </span>
                <span style={{ fontSize: '12px', color: '#374151', textAlign: 'center' }}>
                  {item.displayOrder}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                  borderRadius: '12px', color: s.color, background: s.bg, textAlign: 'center' }}>
                  {s.label}
                </span>
                <Link href={`/admin/hizmetler/${item.id}`} style={{
                  fontSize: '12px', fontWeight: 600, color: '#C9A84C',
                  textDecoration: 'none', textAlign: 'center',
                }}>
                  Düzenle →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: '16px', fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
        {items.length} hizmet sayfası listeleniyor · Sıralama: display_order sütununa göre
      </p>
    </div>
  );
}
