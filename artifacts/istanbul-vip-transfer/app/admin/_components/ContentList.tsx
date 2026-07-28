'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { ContentStatus } from '@/lib/workflow';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: Date;
  publishedAt: Date | null;
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
            gridTemplateColumns: '1fr 200px 130px 160px 90px',
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
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 200px 130px 160px 90px',
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

            <div style={{ display: 'flex', gap: '4px' }}>
              <Link
                href={`${baseUrl}/${item.id}`}
                title="Düzenle"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <Pencil size={14} />
              </Link>
              <button
                onClick={() => handleDelete(item.id, item.title)}
                disabled={deleting === item.id}
                title="Sil"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#FEF2F2',
                  color: '#D64545',
                  border: 'none',
                  cursor: deleting === item.id ? 'not-allowed' : 'pointer',
                  opacity: deleting === item.id ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
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
