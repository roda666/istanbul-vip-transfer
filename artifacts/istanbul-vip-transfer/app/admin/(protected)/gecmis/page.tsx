import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import { getAuditActionLabel, getAuditRecordLabel } from '@/lib/audit-history-display';

export const metadata: Metadata = { title: 'İşlem Geçmişi | Admin', robots: { index: false } };

async function getAuditLogs(page: number, limit: number) {
  try {
    const { db } = await import('@/db');
    const { auditLogs, adminUsers } = await import('@/db/schema');
    const { and, count, desc, eq, ne, notInArray } = await import('drizzle-orm');
    const offset = (page - 1) * limit;
    const criticalOnly = and(
      ne(auditLogs.entityType, 'AdminAccess'),
      notInArray(auditLogs.action, ['LOGIN', 'LOGOUT']),
    );

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
      }).from(auditLogs)
        .leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id))
        .where(criticalOnly)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(auditLogs).where(criticalOnly),
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

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN:   { bg: '#F0FDF4', text: '#168C5B' },
  LOGOUT:  { bg: '#FEF2F2', text: '#D64545' },
  CREATE:  { bg: '#EFF6FF', text: '#2563EB' },
  UPDATE:  { bg: '#FFFBEB', text: '#D97706' },
  DELETE:  { bg: '#FEF2F2', text: '#D64545' },
  APPROVE: { bg: '#F0FDF4', text: '#168C5B' },
  PUBLISH: { bg: '#ECFDF5', text: '#059669' },
  ARCHIVE: { bg: '#F8FAFC', text: '#64748B' },
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
      <style>{`
        .audit-table { display: grid; }
        .audit-row { display: grid; grid-template-columns: 160px minmax(130px, 1fr) minmax(130px, 1fr) minmax(180px, 2fr); gap: 16px; }
        .audit-mobile-label { display: none; }
        @media (max-width: 760px) {
          .audit-table { display: block; }
          .audit-head { display: none !important; }
          .audit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; padding: 14px 16px !important; }
          .audit-cell { min-width: 0; }
          .audit-mobile-label { display: block; color: #9AAAB7; font: 600 10px Inter, sans-serif; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px; }
          .audit-record { grid-column: 1 / -1; }
        }
      `}</style>

      {rows.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#718596', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>Henüz işlem kaydı yok.</p>
        </div>
      ) : (
        <>
           <div className="audit-table" style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            {/* Header */}
             <div className="audit-row audit-head" style={{ padding: '10px 16px', borderBottom: '1px solid #D8E1E9', background: '#F8FAFC' }}>
               {['Tarih/Saat', 'Admin', 'İşlem / kayıt', 'Detay'].map(h => (
                <span key={h} style={{ color: '#718596', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {rows.map((row, i) => {
              const actionStyle = ACTION_COLORS[row.action] ?? { bg: '#F8FAFC', text: '#64748B' };
              return (
                <div key={row.id} className="audit-row" style={{ padding: '12px 16px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid #EDF2F7' : 'none' }}>
                  <div className="audit-cell"><span className="audit-mobile-label">Tarih / saat</span><span style={{ color: '#718596', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(row.createdAt)}</span></div>
                  <div className="audit-cell"><span className="audit-mobile-label">Admin</span><span title={row.adminEmail ?? undefined} style={{ color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{row.adminName ?? row.adminEmail ?? 'Sistem'}</span></div>
                  <div className="audit-cell"><span className="audit-mobile-label">İşlem / kayıt</span><span style={{ padding: '3px 8px', borderRadius: '4px', background: actionStyle.bg, color: actionStyle.text, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 700, display: 'inline-block' }}>{getAuditActionLabel(row.action)}</span><span style={{ display: 'block', color: '#718596', fontSize: '11px', marginTop: '4px' }}>{row.entityType ?? 'Kayıt'}</span></div>
                  <div className="audit-cell audit-record"><span className="audit-mobile-label">İlgili kayıt</span><span style={{ color: '#718596', fontSize: '11px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{getAuditRecordLabel(row.entityId, row.metadata)}</span></div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#718596', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                Sayfa {page} / {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {page > 1 && (
                  <Link href={`?page=${page - 1}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#FFFFFF', border: '1px solid #D8E1E9', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                    <ChevronLeft size={13} /> Önceki
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#FFFFFF', border: '1px solid #D8E1E9', color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
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
