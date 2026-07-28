import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, Calendar, Globe, AlertTriangle } from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Dashboard | Admin',
  robots: { index: false, follow: false },
};

interface StatusCard {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  href: string;
}

async function getStatusCounts() {
  try {
    const { db } = await import('@/db');
    const { content } = await import('@/db/schema');
    const { count } = await import('drizzle-orm');

    const rows = await db
      .select({ status: content.status, count: count() })
      .from(content)
      .groupBy(content.status);

    const map: Record<string, number> = {};
    for (const row of rows) map[row.status] = row.count;

    return {
      DRAFT: map['DRAFT'] ?? 0,
      RESEARCH: map['RESEARCH'] ?? 0,
      REVIEW: map['REVIEW'] ?? 0,
      APPROVED: map['APPROVED'] ?? 0,
      SCHEDULED: map['SCHEDULED'] ?? 0,
      PUBLISHED: map['PUBLISHED'] ?? 0,
      ARCHIVED: map['ARCHIVED'] ?? 0,
      total: rows.reduce((s, r) => s + r.count, 0),
    };
  } catch {
    return null;
  }
}

async function getRecentAuditLogs() {
  try {
    const { db } = await import('@/db');
    const { auditLogs, adminUsers } = await import('@/db/schema');
    const { desc, eq } = await import('drizzle-orm');

    return await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        adminName: adminUsers.name,
      })
      .from(auditLogs)
      .leftJoin(adminUsers, eq(auditLogs.adminUserId, adminUsers.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);
  } catch {
    return [];
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

export default async function DashboardPage() {
  const [counts, logs] = await Promise.all([getStatusCounts(), getRecentAuditLogs()]);

  const dbError = counts === null;

  const cards: StatusCard[] = counts
    ? [
        {
          label: 'Taslak',
          count: counts.DRAFT + counts.RESEARCH,
          icon: <FileText size={20} />,
          color: '#64748B',
          bgColor: '#F1F5F9',
          href: '/admin/sayfalar',
        },
        {
          label: 'İncelemede',
          count: counts.REVIEW,
          icon: <Clock size={20} />,
          color: '#D97706',
          bgColor: '#FFFBEB',
          href: '/admin/sayfalar',
        },
        {
          label: 'Onaylandı',
          count: counts.APPROVED,
          icon: <CheckCircle size={20} />,
          color: '#168C5B',
          bgColor: '#F0FDF4',
          href: '/admin/sayfalar',
        },
        {
          label: 'Zamanlandı',
          count: counts.SCHEDULED,
          icon: <Calendar size={20} />,
          color: '#7C3AED',
          bgColor: '#F5F3FF',
          href: '/admin/sayfalar',
        },
        {
          label: 'Yayında',
          count: counts.PUBLISHED,
          icon: <Globe size={20} />,
          color: '#059669',
          bgColor: '#ECFDF5',
          href: '/admin/sayfalar',
        },
      ]
    : [];

  return (
    <div style={{ padding: '28px 24px' }}>
      <style>{`
        .dashboard-card {
          background: #FFFFFF;
          border: 1px solid #D8E1E9;
          border-radius: 12px;
          padding: 20px;
          transition: border-color 0.15s, box-shadow 0.15s;
          cursor: pointer;
        }
        .dashboard-card:hover,
        .dashboard-card:focus-within {
          border-color: #2563EB;
          box-shadow: 0 4px 16px rgba(37,99,235,0.08);
        }
      `}</style>
      <AdminPageHeader
        title="Dashboard"
        description="İçerik durumu ve son işlemler"
      />

      {dbError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#D64545', flexShrink: 0 }} />
          <p style={{ color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Veritabanına bağlanılamadı. DATABASE_URL ve migrationların çalıştırıldığını kontrol edin.
          </p>
        </div>
      )}

      {/* Status cards */}
      {!dbError && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {cards.map((card) => (
            <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
              <div className="dashboard-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: card.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: card.color }}>{card.icon}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#172B3A',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {card.count}
                  </span>
                </div>
                <p
                  style={{
                    color: '#718596',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                    margin: 0,
                    letterSpacing: '0.05em',
                    fontWeight: 500,
                  }}
                >
                  {card.label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {logs.length > 0 && (
        <div>
          <h2
            style={{
              color: '#52697A',
              fontSize: '11px',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '12px',
              fontWeight: 600,
            }}
          >
            Son İşlemler
          </h2>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D8E1E9',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {logs.map((log, i) => {
              const actionStyle = ACTION_COLORS[log.action] ?? { bg: '#F8FAFC', text: '#64748B' };
              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: i < logs.length - 1 ? '1px solid #EDF2F7' : 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: actionStyle.bg,
                      color: actionStyle.text,
                      fontSize: '10px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.action}
                  </span>
                  <span style={{ color: '#52697A', fontSize: '12px', fontFamily: 'Inter, sans-serif', flex: 1, minWidth: 0 }}>
                    {log.entityType ?? '—'}{log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}
                  </span>
                  <span style={{ color: '#718596', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    {log.adminName ?? '—'}
                  </span>
                  <span style={{ color: '#A0B0BC', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <Link
              href="/admin/gecmis"
              style={{ color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              Tüm geçmişi görüntüle →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
