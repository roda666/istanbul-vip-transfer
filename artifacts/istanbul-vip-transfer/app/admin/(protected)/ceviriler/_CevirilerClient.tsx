'use client';

import { useState } from 'react';
import { Globe, Loader2, Archive, Brain, AlertTriangle } from 'lucide-react';
import type { Language } from '@/db/schema';

/* ── Status config ─────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NOT_STARTED: { label: 'Başlanmadı',   bg: '#F8FAFC', text: '#6B7A8A', border: '#D9E2EC' },
  QUEUED:      { label: 'Sırada',       bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  TRANSLATING: { label: 'Çevriliyor',  bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  DRAFT:       { label: 'Taslak',       bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  REVIEW:      { label: 'İncelemede',  bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  APPROVED:    { label: 'Onaylı',       bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  SCHEDULED:   { label: 'Planlandı',   bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  PUBLISHED:   { label: 'Yayında',     bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  FAILED:      { label: 'Başarısız',   bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  OUTDATED:    { label: 'Güncel Değil', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  ARCHIVED:    { label: 'Arşivlendi',  bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
};

type Job = {
  id: string;
  entityType: string;
  entityId: string;
  targetLanguageCode: string;
  status: string;
  title: string | null;
  isAiGenerated: boolean;
  updatedAt: Date;
  approvedAt: Date | null;
  publishedAt: Date | null;
  sourceTitle: string;
  sourceSlug: string;
  sourceStatus: string;
};

interface Props {
  jobs: Job[];
  langs: Language[];
  page: number;
  total: number;
  limit: number;
}

/* ── Responsive CSS injected once ─────────────────────────────────────── */
const STYLE = `
  .ct-table-wrap { display: block; }
  .ct-cards      { display: none;  }
  @media (max-width: 767px) {
    .ct-table-wrap { display: none !important; }
    .ct-cards      { display: flex !important; flex-direction: column; gap: 10px; }
  }
  .ct-card {
    background: #FFFFFF;
    border: 1px solid #E8EDF3;
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 1px 4px rgba(16,42,67,0.05);
  }
  .ct-card-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
    margin-bottom: 10px;
  }
  .ct-card-title {
    font-size: 14px; font-weight: 600; color: #1A2B3C;
    font-family: Inter, sans-serif; line-height: 1.3;
  }
  .ct-card-meta {
    font-size: 11px; color: #8899AA; margin-top: 2px; font-family: Inter, sans-serif;
  }
  .ct-card-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; margin-bottom: 8px;
  }
  .ct-card-label {
    font-size: 11px; color: #60758A; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em;
    font-family: Inter, sans-serif; flex-shrink: 0;
  }
  .ct-card-actions {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;
    border-top: 1px solid #F1F5F9; padding-top: 10px;
  }
  .ct-action-btn {
    flex: 1; min-width: 80px;
    min-height: 44px;
    display: flex; align-items: center; justify-content: center; gap: 4px;
    border-radius: 8px; font-size: 12px; font-weight: 600;
    font-family: Inter, sans-serif; cursor: pointer;
    border: 1px solid; padding: 8px 10px;
  }
  /* Desktop action buttons keep their compact size */
  .ct-tbl-btn {
    padding: 4px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 600; font-family: Inter, sans-serif;
    display: flex; align-items: center; gap: 3px; cursor: pointer;
  }
`;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {status === 'OUTDATED'    && <AlertTriangle size={10} />}
      {status === 'TRANSLATING' && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
      {cfg.label}
    </span>
  );
}

export default function CevirilerClient({ jobs: initialJobs, page, total, limit }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doAction(jobId: string, action: string) {
    setLoading(jobId);
    setError(null);
    try {
      const res = await fetch(`/admin/api/translations/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'İşlem başarısız');
      }
      const data = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...(data as { item: Job }).item } : j)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const emptyState = (
    <div className="rounded-2xl p-12 text-center"
      style={{ background: '#FFFFFF', border: '1px solid #E8EDF3' }}>
      <Globe size={32} style={{ color: '#C99A32', margin: '0 auto 12px' }} />
      <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
        Henüz çeviri işi yok.
      </p>
    </div>
  );

  if (jobs.length === 0) return <>{emptyState}</>;

  return (
    <div>
      <style>{STYLE}</style>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {/* ── Desktop table ────────────────────────────────────────────── */}
      <div className="ct-table-wrap rounded-xl overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDF3' }}>
              {['İçerik', 'Dil', 'Durum', 'Kaynak', 'Güncelleme', 'İşlemler'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60758A', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => {
              const isLast    = i === jobs.length - 1;
              const isLoading = loading === job.id;
              return (
                <tr key={job.id} style={{ borderBottom: isLast ? 'none' : '1px solid #F1F4F8', background: isLoading ? '#FAFBFC' : '#FFFFFF', opacity: isLoading ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 14px', maxWidth: '260px' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#1A2B3C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title ?? job.sourceTitle}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8899AA', marginTop: '2px' }}>
                      {job.entityType} · {job.sourceSlug}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {job.isAiGenerated && <span title="AI tarafından çevrildi"><Brain size={12} style={{ color: '#7C3AED', flexShrink: 0 }} /></span>}
                      <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                        {job.targetLanguageCode}
                      </code>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', color: '#50677A' }}>{job.sourceStatus}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', color: '#8899AA' }}>
                      {new Date(job.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <TableActions job={job} isLoading={isLoading} onAction={doAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ─────────────────────────────────────────────── */}
      <div className="ct-cards">
        {jobs.map((job) => {
          const isLoading = loading === job.id;
          return (
            <div key={job.id} className="ct-card" style={{ opacity: isLoading ? 0.6 : 1 }}>
              <div className="ct-card-header">
                <div style={{ minWidth: 0 }}>
                  <div className="ct-card-title">{job.title ?? job.sourceTitle}</div>
                  <div className="ct-card-meta">{job.entityType} · {job.sourceSlug}</div>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Dil</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {job.isAiGenerated && <Brain size={12} style={{ color: '#7C3AED' }} />}
                  <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                    {job.targetLanguageCode}
                  </code>
                </div>
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Kaynak</span>
                <span style={{ fontSize: '12px', color: '#50677A' }}>{job.sourceStatus}</span>
              </div>

              <div className="ct-card-row">
                <span className="ct-card-label">Güncelleme</span>
                <span style={{ fontSize: '12px', color: '#8899AA' }}>
                  {new Date(job.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>

              <div className="ct-card-actions">
                {job.status === 'DRAFT' && (
                  <button className="ct-action-btn"
                    style={{ background: '#FFF7ED', color: '#C2410C', borderColor: '#FDBA74' }}
                    onClick={() => doAction(job.id, 'submit_review')} disabled={isLoading}>
                    📤 İncelemeye Gönder
                  </button>
                )}
                {job.status === 'REVIEW' && (
                  <button className="ct-action-btn"
                    style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                    onClick={() => doAction(job.id, 'approve')} disabled={isLoading}>
                    ✓ Onayla
                  </button>
                )}
                {job.status === 'APPROVED' && (
                  <button className="ct-action-btn"
                    style={{ background: '#F0FDF4', color: '#166534', borderColor: '#86EFAC' }}
                    onClick={() => doAction(job.id, 'publish')} disabled={isLoading}>
                    🚀 Yayınla
                  </button>
                )}
                {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
                  <button className="ct-action-btn"
                    style={{ background: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1', flex: 0 }}
                    onClick={() => doAction(job.id, 'archive')} disabled={isLoading}>
                    <Archive size={13} /> Arşiv
                  </button>
                )}
                {isLoading && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#60748A', fontFamily: 'Inter, sans-serif' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> İşleniyor…
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex justify-between items-center text-sm" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', marginTop: '16px' }}>
          <span>{total} kayıt</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {page > 1 && (
              <a href={`/admin/ceviriler?page=${page - 1}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                ← Önceki
              </a>
            )}
            {page * limit < total && (
              <a href={`/admin/ceviriler?page=${page + 1}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                Sonraki →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Desktop table action buttons ──────────────────────────────────────── */
function TableActions({ job, isLoading, onAction }: { job: Job; isLoading: boolean; onAction: (id: string, action: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {job.status === 'DRAFT' && (
        <TblBtn label="İncelemeye Gönder" color="#C2410C" bg="#FFF7ED" border="#FDBA74"
          onClick={() => onAction(job.id, 'submit_review')} disabled={isLoading} />
      )}
      {job.status === 'REVIEW' && (
        <TblBtn label="Onayla" color="#065F46" bg="#ECFDF5" border="#A7F3D0"
          onClick={() => onAction(job.id, 'approve')} disabled={isLoading} />
      )}
      {job.status === 'APPROVED' && (
        <TblBtn label="Yayınla" color="#166534" bg="#F0FDF4" border="#86EFAC"
          onClick={() => onAction(job.id, 'publish')} disabled={isLoading} />
      )}
      {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
        <TblBtn label="Arşiv" color="#64748B" bg="#F1F5F9" border="#CBD5E1"
          onClick={() => onAction(job.id, 'archive')} disabled={isLoading} icon={<Archive size={10} />} />
      )}
    </div>
  );
}

function TblBtn({ label, color, bg, border, onClick, disabled, icon }: {
  label: string; color: string; bg: string; border: string;
  onClick: () => void; disabled: boolean; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="ct-tbl-btn"
      style={{ background: bg, color, border: `1px solid ${border}`, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {icon}{label}
    </button>
  );
}
