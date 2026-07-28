'use client';

import { useState } from 'react';
import { Globe, Loader2, Archive, Brain, AlertTriangle } from 'lucide-react';
import type { Language } from '@/db/schema';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NOT_STARTED: { label: 'Başlanmadı', bg: '#F8FAFC', text: '#6B7A8A', border: '#D9E2EC' },
  QUEUED:      { label: 'Sırada', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  TRANSLATING: { label: 'Çevriliyor', bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  DRAFT:       { label: 'Taslak', bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  REVIEW:      { label: 'İncelemede', bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  APPROVED:    { label: 'Onaylı', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  SCHEDULED:   { label: 'Planlandı', bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  PUBLISHED:   { label: 'Yayında', bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  FAILED:      { label: 'Başarısız', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  OUTDATED:    { label: 'Güncel Değil', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  ARCHIVED:    { label: 'Arşivlendi', bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
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
        throw new Error(data.error ?? 'İşlem başarısız');
      }
      const data = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...data.item } : j)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(null);
    }
  }

  const emptyState = (
    <div
      className="rounded-2xl p-12 text-center"
      style={{ background: '#FFFFFF', border: '1px solid #E8EDF3' }}
    >
      <Globe size={32} style={{ color: '#C99A32', margin: '0 auto 12px' }} />
      <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
        Henüz çeviri işi yok. Blog yazılarında <strong>AI ile Çevir</strong> butonunu kullanarak başlayın.
      </p>
    </div>
  );

  return (
    <div>
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontFamily: 'Inter, sans-serif' }}
        >
          {error}
        </div>
      )}

      {jobs.length === 0 ? emptyState : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EDF3', boxShadow: '0 1px 4px rgba(16,42,67,0.06)' }}>
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
                const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.NOT_STARTED;
                const isLast = i === jobs.length - 1;
                const isLoading = loading === job.id;

                return (
                  <tr
                    key={job.id}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #F1F4F8',
                      background: isLoading ? '#FAFBFC' : '#FFFFFF',
                      opacity: isLoading ? 0.6 : 1,
                    }}
                  >
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
                        {job.isAiGenerated && (
                          <span title="AI tarafından çevrildi"><Brain size={12} style={{ color: '#7C3AED', flexShrink: 0 }} /></span>
                        )}
                        <code style={{ fontSize: '12px', background: '#F3F6FA', padding: '2px 6px', borderRadius: '4px', color: '#2D5FA3' }}>
                          {job.targetLanguageCode}
                        </code>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
                          background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        {job.status === 'OUTDATED' && <AlertTriangle size={10} />}
                        {job.status === 'TRANSLATING' && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
                        {cfg.label}
                      </span>
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
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {job.status === 'DRAFT' && (
                          <ActionButton label="İncele" color="#C2410C" bg="#FFF7ED" border="#FDBA74"
                            onClick={() => doAction(job.id, 'submit_review')} disabled={isLoading} />
                        )}
                        {job.status === 'REVIEW' && (
                          <ActionButton label="Onayla" color="#065F46" bg="#ECFDF5" border="#A7F3D0"
                            onClick={() => doAction(job.id, 'approve')} disabled={isLoading} />
                        )}
                        {job.status === 'APPROVED' && (
                          <ActionButton label="Yayınla" color="#166534" bg="#F0FDF4" border="#86EFAC"
                            onClick={() => doAction(job.id, 'publish')} disabled={isLoading} />
                        )}
                        {['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'FAILED', 'OUTDATED'].includes(job.status) && (
                          <ActionButton label="Arşiv" color="#64748B" bg="#F1F5F9" border="#CBD5E1"
                            onClick={() => doAction(job.id, 'archive')} disabled={isLoading} icon={<Archive size={10} />} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="mt-4 flex justify-between items-center text-sm" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
          <span>{total} kayıt</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {page > 1 && (
              <a href={`/admin/ceviriler?page=${page - 1}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55' }}>
                ← Önceki
              </a>
            )}
            {page * limit < total && (
              <a href={`/admin/ceviriler?page=${page + 1}`}
                style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D9E2EC', textDecoration: 'none', color: '#263F55' }}>
                Sonraki →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label, color, bg, border, onClick, disabled, icon,
}: {
  label: string; color: string; bg: string; border: string;
  onClick: () => void; disabled: boolean; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 8px', borderRadius: '6px', border: `1px solid ${border}`,
        background: bg, color, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', gap: '3px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
