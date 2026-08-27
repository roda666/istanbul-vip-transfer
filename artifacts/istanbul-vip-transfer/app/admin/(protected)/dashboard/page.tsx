import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText, Clock, CheckCircle, Calendar, Globe, AlertTriangle, CalendarDays,
  MessageCircle, Languages, Inbox, TriangleAlert, ArrowRight, ShieldCheck,
} from 'lucide-react';
import AdminPageHeader from '../../_components/AdminPageHeader';
import { getIstanbulCalendarDate } from '@/lib/istanbul-time';

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

interface OperationCard extends StatusCard {
  description: string;
}

interface RecentError {
  id: string;
  title: string;
  detail: string;
  createdAt: Date;
  href: string;
}

interface BotProtectionSummary {
  rateLimit: number;
  honeypot: number;
  formTiming: number;
}

interface OperationsCenter {
  today: string;
  tomorrow: string;
  todayTransfers: number;
  tomorrowTransfers: number;
  newRequests: number;
  unansweredChats: number;
  pendingTranslations: number;
}

interface ContentStatusCounts {
  DRAFT: number;
  RESEARCH: number;
  REVIEW: number;
  APPROVED: number;
  SCHEDULED: number;
  PUBLISHED: number;
  ARCHIVED: number;
  total: number;
}

interface DashboardBlock<T> {
  data: T;
  error: string | null;
}

function describeDashboardError(error: unknown): string {
  const databaseError = error as { code?: unknown; message?: unknown; relation?: unknown };
  const message = typeof databaseError?.message === 'string' ? databaseError.message : '';

  if (databaseError?.code === '42P01') {
    const relation = typeof databaseError.relation === 'string'
      ? databaseError.relation
      : message.match(/relation "([^"]+)" does not exist/)?.[1];
    return relation
      ? `Gerekli veritabanı tablosu bulunamadı: ${relation}. İlgili migration uygulanmalı.`
      : 'Gerekli bir veritabanı tablosu bulunamadı. İlgili migration uygulanmalı.';
  }

  if (databaseError?.code === '42703') {
    return 'Gerekli veritabanı sütunu bulunamadı. İlgili migration uygulanmalı.';
  }

  return 'Bu veri bloğu şu anda yüklenemedi. Diğer panel verileri kullanılmaya devam edebilir.';
}

async function loadDashboardBlock<T>(loader: () => Promise<T>, fallback: T): Promise<DashboardBlock<T>> {
  try {
    return { data: await loader(), error: null };
  } catch (error) {
    return { data: fallback, error: describeDashboardError(error) };
  }
}

async function getOperationsCenter(): Promise<DashboardBlock<OperationsCenter>> {
  const today = getIstanbulCalendarDate(0);
  const tomorrow = getIstanbulCalendarDate(1);
  return loadDashboardBlock(async () => {
    const { db } = await import('@/db');
    const {
      reservationRequests,
      chatbotSessions,
      chatbotMessages,
      contentTranslations,
    } = await import('@/db/schema');
    const { and, count, eq, inArray, isNull, sql } = await import('drizzle-orm');
    const pendingTranslationStatuses = ['QUEUED', 'TRANSLATING', 'DRAFT', 'REVIEW'] as const;

    const [
      todayTransfers,
      tomorrowTransfers,
      newRequests,
      unansweredChats,
      pendingTranslations,
    ] = await Promise.all([
      db.select({ count: count() }).from(reservationRequests).where(and(
        isNull(reservationRequests.archivedAt),
        sql`${reservationRequests.requestData}->>'tarih' = ${today}`,
      )),
      db.select({ count: count() }).from(reservationRequests).where(and(
        isNull(reservationRequests.archivedAt),
        sql`${reservationRequests.requestData}->>'tarih' = ${tomorrow}`,
      )),
      db.select({ count: count() }).from(reservationRequests).where(and(
        isNull(reservationRequests.archivedAt),
        eq(reservationRequests.status, 'NEW'),
      )),
      db.select({ count: count() }).from(chatbotSessions).where(and(
        isNull(chatbotSessions.resolvedAt),
        sql`(
          SELECT ${chatbotMessages.role}
          FROM ${chatbotMessages}
          WHERE ${chatbotMessages.sessionId} = ${chatbotSessions.id}
          ORDER BY ${chatbotMessages.createdAt} DESC
          LIMIT 1
        ) = 'user'`,
      )),
      db.select({ count: count() }).from(contentTranslations).where(
        inArray(contentTranslations.status, pendingTranslationStatuses),
      ),
    ]);

    return {
      today,
      tomorrow,
      todayTransfers: todayTransfers[0]?.count ?? 0,
      tomorrowTransfers: tomorrowTransfers[0]?.count ?? 0,
      newRequests: newRequests[0]?.count ?? 0,
      unansweredChats: unansweredChats[0]?.count ?? 0,
      pendingTranslations: pendingTranslations[0]?.count ?? 0,
    };
  }, {
    today,
    tomorrow,
    todayTransfers: 0,
    tomorrowTransfers: 0,
    newRequests: 0,
    unansweredChats: 0,
    pendingTranslations: 0,
  });
}

async function getStatusCounts(): Promise<DashboardBlock<ContentStatusCounts>> {
  return loadDashboardBlock(async () => {
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
  }, {
    DRAFT: 0,
    RESEARCH: 0,
    REVIEW: 0,
    APPROVED: 0,
    SCHEDULED: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
    total: 0,
  });
}

async function getBotProtectionSummary(): Promise<DashboardBlock<BotProtectionSummary | null>> {
  return loadDashboardBlock(async () => {
    const { db } = await import('@/db');
    const { botProtectionMetrics } = await import('@/db/schema');
    const { gte, sql } = await import('drizzle-orm');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        reason: botProtectionMetrics.reason,
        count: sql<number>`coalesce(sum(${botProtectionMetrics.blockedCount}), 0)::int`,
      })
      .from(botProtectionMetrics)
      .where(gte(botProtectionMetrics.bucketStart, since))
      .groupBy(botProtectionMetrics.reason);

    const byReason = new Map(rows.map((row) => [row.reason, row.count]));
    return {
      rateLimit: byReason.get('RATE_LIMIT') ?? 0,
      honeypot: byReason.get('HONEYPOT') ?? 0,
      formTiming: byReason.get('FORM_TIMING') ?? 0,
    };
  }, null);
}

async function getRecentAuditLogs(): Promise<DashboardBlock<Array<{
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  adminName: string | null;
}>>> {
  return loadDashboardBlock(async () => {
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
  }, []);
}

async function getRecentErrors(): Promise<DashboardBlock<RecentError[]>> {
  try {
    const { db } = await import('@/db');
    const { contentTranslations, reservationSubmissionFailures } = await import('@/db/schema');
    const { desc, eq, isNull } = await import('drizzle-orm');

    const [translations, submissions] = await Promise.all([
      loadDashboardBlock(async () => db.select({
        id: contentTranslations.id,
        entityType: contentTranslations.entityType,
        targetLanguageCode: contentTranslations.targetLanguageCode,
        failureReason: contentTranslations.failureReason,
        createdAt: contentTranslations.updatedAt,
      }).from(contentTranslations)
        .where(eq(contentTranslations.status, 'FAILED'))
        .orderBy(desc(contentTranslations.updatedAt))
        .limit(5), []),
      loadDashboardBlock(async () => db.select({
        id: reservationSubmissionFailures.id,
        referenceNumber: reservationSubmissionFailures.referenceNumber,
        lastError: reservationSubmissionFailures.lastError,
        createdAt: reservationSubmissionFailures.updatedAt,
      }).from(reservationSubmissionFailures)
        .where(isNull(reservationSubmissionFailures.resolvedAt))
        .orderBy(desc(reservationSubmissionFailures.updatedAt))
        .limit(5), []),
    ]);

    const errors: RecentError[] = [
      ...translations.data.map((error) => ({
        id: `translation-${error.id}`,
        title: `${error.entityType} çevirisi (${error.targetLanguageCode.toUpperCase()})`,
        detail: error.failureReason ?? 'Çeviri işlemi başarısız oldu.',
        createdAt: error.createdAt,
        href: '/admin/ceviriler',
      })),
      ...submissions.data.map((error) => ({
        id: `reservation-${error.id}`,
        title: `Talep kaydedilemedi: ${error.referenceNumber}`,
        detail: error.lastError,
        createdAt: error.createdAt,
        href: '/admin/talepler',
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

    const loadErrors = [translations.error, submissions.error].filter(Boolean);
    return { data: errors, error: loadErrors.length > 0 ? loadErrors.join(' ') : null };
  } catch (error) {
    return { data: [], error: describeDashboardError(error) };
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

function DashboardBlockWarning({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '9px',
        background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px',
        padding: '12px 14px', marginBottom: '12px', color: '#92400E',
        fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: 1.45,
      }}
    >
      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>{message}</span>
    </div>
  );
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
  const [operations, counts, logs, botProtection, recentErrors] = await Promise.all([
    getOperationsCenter(),
    getStatusCounts(),
    getRecentAuditLogs(),
    getBotProtectionSummary(),
    getRecentErrors(),
  ]);

  const operationCards: OperationCard[] = [
        {
          label: 'Bugünkü Transferler',
          description: `${operations.data.today} tarihli planlanan talepler`,
          count: operations.data.todayTransfers,
          icon: <CalendarDays size={20} />,
          color: '#2563EB',
          bgColor: '#EFF6FF',
          href: '/admin/talepler',
        },
        {
          label: 'Yarınki Transferler',
          description: `${operations.data.tomorrow} tarihli planlanan talepler`,
          count: operations.data.tomorrowTransfers,
          icon: <Calendar size={20} />,
          color: '#7C3AED',
          bgColor: '#F5F3FF',
          href: '/admin/talepler',
        },
        {
          label: 'Yeni Rezervasyon Talepleri',
          description: 'Henüz işlem bekleyen yeni talepler',
          count: operations.data.newRequests,
          icon: <Inbox size={20} />,
          color: '#D97706',
          bgColor: '#FFFBEB',
          href: '/admin/talepler',
        },
        {
          label: 'Yanıt Bekleyen Sohbetler',
          description: 'Son mesajı ziyaretçiden gelen aktif oturumlar',
          count: operations.data.unansweredChats,
          icon: <MessageCircle size={20} />,
          color: '#0F766E',
          bgColor: '#F0FDFA',
          href: '/admin/sohbet',
        },
        {
          label: 'Bekleyen Çeviriler',
          description: 'Sırada, çeviride, taslakta veya incelemede',
          count: operations.data.pendingTranslations,
          icon: <Languages size={20} />,
          color: '#7C3AED',
          bgColor: '#F5F3FF',
          href: '/admin/ceviriler',
        },
      ];

  const cards: StatusCard[] = [
        {
          label: 'Taslak',
          count: counts.data.DRAFT + counts.data.RESEARCH,
          icon: <FileText size={20} />,
          color: '#64748B',
          bgColor: '#F1F5F9',
          href: '/admin/sayfalar',
        },
        {
          label: 'İncelemede',
          count: counts.data.REVIEW,
          icon: <Clock size={20} />,
          color: '#D97706',
          bgColor: '#FFFBEB',
          href: '/admin/sayfalar',
        },
        {
          label: 'Onaylandı',
          count: counts.data.APPROVED,
          icon: <CheckCircle size={20} />,
          color: '#168C5B',
          bgColor: '#F0FDF4',
          href: '/admin/sayfalar',
        },
        {
          label: 'Zamanlandı',
          count: counts.data.SCHEDULED,
          icon: <Calendar size={20} />,
          color: '#7C3AED',
          bgColor: '#F5F3FF',
          href: '/admin/sayfalar',
        },
        {
          label: 'Yayında',
          count: counts.data.PUBLISHED,
          icon: <Globe size={20} />,
          color: '#059669',
          bgColor: '#ECFDF5',
          href: '/admin/sayfalar',
        },
      ];

  return (
    <div className="dashboard-page" style={{ padding: '28px 24px' }}>
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
        .dashboard-error-row:hover {
          background: #FFF8F8;
        }
        @media (max-width: 640px) {
          .dashboard-page { padding: 20px 16px !important; }
          .dashboard-log-admin { display: none; }
        }
      `}</style>
      <AdminPageHeader
        title="Dashboard"
        description="Günlük operasyonlar, talepler ve içerik iş akışı"
      />

      <section style={{ marginBottom: '32px' }}>
          <h2
            style={{
              color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600,
            }}
          >
            Operasyon Merkezi
          </h2>
          {operations.error && <DashboardBlockWarning message={operations.error} />}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {operationCards.map((card) => (
              <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
                <div className="dashboard-card" style={{ height: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: card.color }}>{card.icon}</span>
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>
                      {card.count}
                    </span>
                  </div>
                  <p style={{ color: '#334E68', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 5px', fontWeight: 650 }}>
                    {card.label}
                  </p>
                  <p style={{ color: '#718596', fontSize: '11px', lineHeight: 1.45, fontFamily: 'Inter, sans-serif', margin: 0 }}>
                    {card.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
          <h2
            style={{
              color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600,
            }}
          >
            Bot Koruması · Son 24 Saat
          </h2>
          {botProtection.error && <DashboardBlockWarning message={botProtection.error} />}
          {botProtection.data ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                { label: 'Hız limiti engeli', count: botProtection.data.rateLimit, color: '#D97706', bg: '#FFFBEB' },
                { label: 'Tuzak alan engeli', count: botProtection.data.honeypot, color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Süre doğrulama engeli', count: botProtection.data.formTiming, color: '#7C3AED', bg: '#F5F3FF' },
              ].map((item) => (
                <div key={item.label} className="dashboard-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={20} style={{ color: item.color }} />
                    </div>
                    <span style={{ fontSize: '28px', fontWeight: 700, color: '#172B3A', fontFamily: 'Inter, sans-serif' }}>{item.count}</span>
                  </div>
                  <p style={{ color: '#334E68', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0, fontWeight: 650 }}>{item.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', color: '#92400E', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
              {botProtection.error ?? 'Koruma sayaçları şu anda alınamıyor.'}
            </div>
          )}
      </section>

      <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h2 style={{ color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>
              Son Hatalar
            </h2>
            <Link href="/admin/ceviriler" style={{ color: '#2563EB', fontSize: '12px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
              Çevirileri aç <ArrowRight size={13} style={{ verticalAlign: '-2px' }} />
            </Link>
          </div>
          {recentErrors.error && <DashboardBlockWarning message={recentErrors.error} />}
          <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
            {recentErrors.data.length === 0 ? (
              <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#168C5B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <CheckCircle size={18} /> Yakın zamanda kaydedilmiş hata yok.
              </div>
            ) : recentErrors.data.map((error, index) => (
              <Link key={error.id} href={error.href} className="dashboard-error-row" style={{ display: 'block', padding: '13px 16px', textDecoration: 'none', borderBottom: index < recentErrors.data.length - 1 ? '1px solid #EDF2F7' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <TriangleAlert size={17} style={{ color: '#D64545', flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                      <span style={{ color: '#334E68', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{error.title}</span>
                      <span style={{ color: '#A0B0BC', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{formatDate(error.createdAt)}</span>
                    </div>
                    <p style={{ color: '#718596', fontSize: '12px', lineHeight: 1.4, fontFamily: 'Inter, sans-serif', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{error.detail}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

      {/* Content status cards */}
      <section style={{ marginBottom: '32px' }}>
          <h2
            style={{
              color: '#52697A', fontSize: '11px', fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600,
            }}
          >
            İçerik Durumu
          </h2>
          {counts.error && <DashboardBlockWarning message={counts.error} />}
          <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
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
      </section>

      {/* Recent activity */}
      {(logs.data.length > 0 || logs.error) && (
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
          {logs.error && <DashboardBlockWarning message={logs.error} />}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D8E1E9',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {logs.data.map((log, i) => {
              const actionStyle = ACTION_COLORS[log.action] ?? { bg: '#F8FAFC', text: '#64748B' };
              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                     borderBottom: i < logs.data.length - 1 ? '1px solid #EDF2F7' : 'none',
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
                    <span className="dashboard-log-admin" style={{ color: '#718596', fontSize: '11px', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
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
