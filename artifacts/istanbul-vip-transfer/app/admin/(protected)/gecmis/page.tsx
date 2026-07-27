import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

export const metadata: Metadata = { title: 'İşlem Geçmişi | Admin', robots: { index: false } };

async function getAuditLogs(page: number, limit: number) {
  try {
    const { db } = await import('@/db');
    const { auditLogs, adminUsers } = await import('@/db/schema');
    const { desc, eq, count } = await import('drizzle-orm');
    const offset = (page - 1) * limit;

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
        adminName: adminUsers.name,
        adminEmail: adminUsers.email,
      }).from(auditLogs).leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id)).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(auditLogs),
    ]);

    return { rows, total: totalRows[0]?.count ?? 0 };
  } catch {
    return { rows: [], total: 0, error: true };
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(date));
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: '#86efac', LOGOUT: '#fca5a5', CREATE: '#93c5fd', UPDATE: '#fbbf24',
  DELETE: '#f87171', APPROVE: '#4ade80', PUBLISH: '#a3e635', ARCHIVE: '#d1d5db',
};

export default async function GecmisPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 25;
  const { rows, total } = await getAuditLogs(page, limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ padding: '28px 24px' }}>
      <AdminPageHeader title="İşlem Geçmişi" description={`Toplam ${total} kayıt`} />

      {rows.length === 0 ? (
        <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#555', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Henüz işlem kaydı yok.</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 120px 90px 160px 1fr', gap: '12px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              {['Tarih/Saat', 'Admin', 'İşlem', 'Tür', 'Detay'].map(h => (
                <span key={h} style={{ color: '#555', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {rows.map((row, i) => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '140px 120px 90px 160px 1fr', gap: '12px', padding: '10px 16px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ color: '#555', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(row.createdAt)}</span>
                <span style={{ color: '#888', fontSize: '12px', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.adminName ?? '—'}</span>
                <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', color: ACTION_COLORS[row.action] ?? '#aaa', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.08em', display: 'inline-block' }}>{row.action}</span>
                <span style={{ color: '#666', fontSize: '12px', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.entityType ?? '—'}</span>
                <span style={{ color: '#444', fontSize: '11px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.entityId ? row.entityId.slice(0, 20) + (row.entityId.length > 20 ? '…' : '') : ''}
                  {row.metadata && typeof row.metadata === 'object' && 'title' in row.metadata ? ` "${(row.metadata as Record<string, unknown>).title}"` : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#555', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                Sayfa {page} / {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {page > 1 && (
                  <Link href={`?page=${page - 1}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                    <ChevronLeft size={13} /> Önceki
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                    Sonraki <ChevronRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
