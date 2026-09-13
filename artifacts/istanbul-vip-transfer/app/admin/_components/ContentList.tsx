'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { AdminRecordActions } from './AdminRecordActions';
import type { ContentStatus } from '@/lib/workflow';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: Date;
  publishedAt: Date | null;
  displayOrder: number;
}

interface Props {
  items: ContentItem[];
  baseUrl: string;
  page: number;
  total: number;
  limit: number;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function ContentList({ items, baseUrl, page, total, limit }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const totalPages = Math.ceil(total / limit);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" içeriğini kalıcı olarak silmek istediğinizden emin misiniz?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/admin/api/content/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Silme işlemi başarısız oldu.');
      }
    } catch {
      alert('Sunucu hatası. Lütfen tekrar deneyin.');
    } finally {
      setDeleting(null);
    }
  }

  async function move(id: string, direction: 'up' | 'down') {
    setMoving(id);
    try {
      const res = await fetch(`/admin/api/content/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: direction }),
      });
      if (res.ok) router.refresh();
      else alert('Sıralama güncellenemedi.');
    } finally { setMoving(null); }
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E1E9',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
          Henüz içerik yok. Yeni bir tane oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E1E9',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 180px 100px 140px minmax(280px, auto)',
            gap: '12px',
            padding: '10px 16px',
            borderBottom: '1px solid #D8E1E9',
            background: '#F8FAFC',
          }}
        >
          {['Başlık', 'Slug', 'Durum', 'Güncellendi', 'İşlemler'].map((h) => (
            <span
              key={h}
              style={{
                color: '#718596',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {items.map((item) => {
          const isSafeToDelete = ['IDEA', 'DRAFT', 'RESEARCH'].includes(item.status);
          const deleteOmittedReason = isSafeToDelete
            ? undefined
            : 'Yayında, onayda veya arşivlenmiş içerikler doğrudan silinemez. Önce taslağa alın.';

          return (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px 100px 140px minmax(280px, auto)',
              gap: '12px',
              padding: '12px 16px',
              alignItems: 'center',
              borderBottom: '1px solid #EDF2F7',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  color: '#172B3A',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </p>
            </div>

            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  color: '#718596',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                /{item.slug}
              </span>
            </div>

            <div>
              <StatusBadge status={item.status as ContentStatus} size="sm" />
            </div>

            <span style={{ color: '#718596', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
              {formatDate(item.updatedAt)}
            </span>

            <div>
              <AdminRecordActions
                up={{
                  onClick: () => move(item.id, 'up'),
                  disabled: moving === item.id,
                }}
                down={{
                  onClick: () => move(item.id, 'down'),
                  disabled: moving === item.id,
                }}
                edit={{
                  href: `${baseUrl}/${item.id}`,
                }}
                delete={isSafeToDelete ? {
                  onClick: () => handleDelete(item.id, item.title),
                  disabled: deleting === item.id,
                } : undefined}
                deleteOmittedReason={deleteOmittedReason}
              />
            </div>
          </div>
        )})}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
          }}
        >
          <span style={{ color: '#718596', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            {total} içerikten {(page - 1) * limit + 1}–{Math.min(page * limit, total)} gösteriliyor
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #D8E1E9',
                  color: '#52697A',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                  textDecoration: 'none',
                }}
              >
                <ChevronLeft size={13} />
                Önceki
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #D8E1E9',
                  color: '#52697A',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Sonraki
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
