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

export default async function DashboardPage() {
  const [counts, logs] = await Promise.all([getStatusCounts(), getRecentAuditLogs()]);

  const dbError = counts === null;

  const cards: StatusCard[] = counts
    ? [
        {
          label: 'Taslak',
          count: counts.DRAFT + counts.RESEARCH,
          icon: <FileText size={20} />,
          color: '#666',
          href: '/admin/sayfalar',
        },
        {
          label: 'İncelemede',
          count: counts.REVIEW,
          icon: <Clock size={20} />,
          color: '#fbbf24',
          href: '/admin/sayfalar',
        },
        {
          label: 'Onaylandı',
          count: counts.APPROVED,
          icon: <CheckCircle size={20} />,
          color: '#86efac',
          href: '/admin/sayfalar',
        },
        {
          label: 'Zamanlandı',
          count: counts.SCHEDULED,
          icon: <Calendar size={20} />,
          color: '#c4b5fd',
          href: '/admin/sayfalar',
        },
        {
          label: 'Yayında',
          count: counts.PUBLISHED,
          icon: <Globe size={20} />,
          color: '#4ade80',
          href: '/admin/sayfalar',
        },
      ]
    : [];

  return (
    <div style={{ padding: '28px 24px' }}>
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
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
          <p style={{ color: '#f87171', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            Veritabanına bağlanılamadı. DATABASE_URL ve migrationların çalıştırıldığını kontrol edin.
            Detaylar için ADMIN_SETUP.md dosyasına bakın.
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
            <Link
              key={card.label}
              href={card.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'border-color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <span style={{ color: card.color }}>{card.icon}</span>
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {card.count}
                  </span>
                </div>
                <p
                  style={{
                    color: '#666',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                    margin: 0,
                    letterSpacing: '0.05em',
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
              color: '#888',
              fontSize: '11px',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            Son İşlemler
          </h2>
          <div
            style={{
              background: '#161616',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {logs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom:
                    i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(201,168,76,0.1)',
                    color: '#C9A84C',
                    fontSize: '10px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {log.action}
                </span>
                <span style={{ color: '#777', fontSize: '12px', fontFamily: 'Inter, sans-serif', flex: 1, minWidth: 0 }}>
                  {log.entityType ?? '—'}{log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}
                </span>
                <span style={{ color: '#444', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                  {log.adminName ?? '—'}
                </span>
                <span style={{ color: '#333', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <Link
              href="/admin/gecmis"
              style={{ color: '#C9A84C', fontSize: '12px', fontFamily: 'Inter, sans-serif', opacity: 0.8 }}
            >
              Tüm geçmişi görüntüle →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
