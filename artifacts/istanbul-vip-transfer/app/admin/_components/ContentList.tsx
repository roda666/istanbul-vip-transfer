'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { AdminRecordActions } from './AdminRecordActions';
import { AdminCmsRecordCard } from './AdminCmsRecordCard';
import type { ContentStatus } from '@/lib/workflow';

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: Date;
  publishedAt: Date | null;
  displayOrder: number;
  translations?: Record<string, unknown>;
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

  async function handleDelete(id: string) {
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
    <div className="space-y-3">
      {items.map((item, index) => {
           // The DELETE endpoint permits every non-live workflow state; it
           // performs the additional navigation-reference guard server-side.
           const isSafeToDelete = ['IDEA', 'DRAFT', 'RESEARCH', 'REVIEW', 'ARCHIVED'].includes(item.status);
          const deleteOmittedReason = isSafeToDelete
            ? undefined
            : 'Yayında, onayda veya arşivlenmiş içerikler doğrudan silinemez. Önce taslağa alın.';

          return (
          <AdminCmsRecordCard
            key={item.id}
            title={item.title}
            description={<><span className="font-mono">/{item.slug}</span><span className="ml-2">{formatDate(item.updatedAt)}</span></>}
            status={<StatusBadge status={item.status as ContentStatus} size="sm" />}
            languageStatuses={{ tr: item.status, ...(item.translations ?? {}) }}
          >
              <AdminRecordActions
                up={{
                  onClick: () => move(item.id, 'up'),
                  disabled: moving === item.id || index === 0,
                }}
                down={{
                  onClick: () => move(item.id, 'down'),
                  disabled: moving === item.id || index === items.length - 1,
                }}
                edit={{
                  href: `${baseUrl}/${item.id}`,
                }}
                delete={{
                  onClick: () => handleDelete(item.id),
                   disabled: deleting === item.id || !isSafeToDelete,
                   disabledReason: !isSafeToDelete ? deleteOmittedReason : undefined,
                  confirmMessage: `"${item.title}" içeriğini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem ilişkili çevirileri de kaldırabilir ve geri alınamaz.`,
                 }}
              />
          </AdminCmsRecordCard>
        )})}

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
