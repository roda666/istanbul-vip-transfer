'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Vehicle } from '@/db/schema';
import type { ContentStatus } from '@/lib/workflow';
import { STATUS_LABELS } from '@/lib/workflow';
import StatusBadge from '../../_components/StatusBadge';

const GOLD = '#C99A32';

const ALL_STATUSES: ContentStatus[] = [
  'DRAFT', 'RESEARCH', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED',
];

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(23,43,58,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E1E9',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(23,43,58,0.12)',
        }}
      >
        <h3
          style={{
            color: '#172B3A',
            fontSize: '16px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            margin: '0 0 12px',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: '#52697A',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#FFFFFF',
              border: '1px solid #D8E1E9',
              borderRadius: '8px',
              color: '#52697A',
              cursor: 'pointer',
              padding: '8px 18px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: danger ? '#FEF2F2' : '#2563EB',
              border: danger ? '1px solid #FECACA' : 'none',
              borderRadius: '8px',
              color: danger ? '#D64545' : '#FFFFFF',
              cursor: 'pointer',
              padding: '8px 18px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const filterInputStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #D8E1E9',
  borderRadius: '6px',
  color: '#172B3A',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  padding: '8px 12px',
  outline: 'none',
};

export default function AraclarList() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<'updatedAt' | 'displayOrder'>('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
        order,
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/admin/api/vehicles?${params}`);
      if (!res.ok) throw new Error('API hatası');
      const json = await res.json();
      setVehicles(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError('Araçlar yüklenemedi. Lütfen sayfayı yenileyin.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, order, page]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);
  useEffect(() => { setPage(1); }, [search, statusFilter, sort, order]);

  function confirmArchive(v: Vehicle) {
    setActionError('');
    setConfirm({
      title: 'Aracı Arşivle',
      message: `"${v.name}" aracı arşivlenecektir. Araç listeden kaldırılır ancak kalıcı olarak silinmez.`,
      confirmLabel: 'Arşivle',
      danger: true,
      onConfirm: () => { setConfirm(null); doArchive(v.id); },
    });
  }

  function confirmDelete(v: Vehicle) {
    setActionError('');
    setConfirm({
      title: 'Aracı Kalıcı Sil',
      message: `"${v.name}" aracı kalıcı olarak silinecektir. Bu işlem geri alınamaz. Hiç yayınlanmamış taslak araçlar için geçerlidir.`,
      confirmLabel: 'Kalıcı Sil',
      danger: true,
      onConfirm: () => { setConfirm(null); doDelete(v.id); },
    });
  }

  async function doArchive(id: string) {
    const res = await fetch(`/admin/api/vehicles/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError(json.error ?? 'Arşivleme başarısız.');
    } else {
      fetchVehicles();
      router.refresh();
    }
  }

  async function doDelete(id: string) {
    const res = await fetch(`/admin/api/vehicles/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError(json.error ?? 'Silme başarısız.');
    } else {
      fetchVehicles();
      router.refresh();
    }
  }

  async function setActive(id: string, active: boolean) {
    const res = await fetch(`/admin/api/vehicles/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: active ? 'activate' : 'deactivate' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setActionError(json.error ?? 'Araç durumu güncellenemedi.');
    } else {
      fetchVehicles();
      router.refresh();
    }
  }

  function formatDate(d: Date | string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Araç adı ara..."
          style={{ ...filterInputStyle, flex: '1 1 200px', minWidth: '160px' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...filterInputStyle, cursor: 'pointer' }}
        >
          <option value="">Tüm Durumlar</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={`${sort}_${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split('_') as [typeof sort, typeof order];
            setSort(s); setOrder(o);
          }}
          style={{ ...filterInputStyle, cursor: 'pointer' }}
        >
          <option value="updatedAt_desc">Son Güncelleme (Yeni)</option>
          <option value="updatedAt_asc">Son Güncelleme (Eski)</option>
          <option value="displayOrder_asc">Sıra (Artan)</option>
          <option value="displayOrder_desc">Sıra (Azalan)</option>
        </select>
      </div>

      {/* ── Action error ── */}
      {actionError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '16px' }}>
          {actionError}
        </div>
      )}

      {/* ── Loading / Error / Empty ── */}
      {loading ? (
        <div style={{ color: '#718596', fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '48px 0', textAlign: 'center' }}>
          Yükleniyor...
        </div>
      ) : error ? (
        <div style={{ color: '#D64545', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>
      ) : vehicles.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '10px', padding: '60px 32px', textAlign: 'center' }}>
          <p style={{ color: '#718596', fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            {search || statusFilter
              ? 'Bu filtreye uyan araç bulunamadı.'
              : 'Henüz araç eklenmedi. İlk aracı eklemek için "Yeni Araç Ekle" butonunu kullanın.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div style={{ background: '#FFFFFF', border: '1px solid #D8E1E9', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #D8E1E9', background: '#F8FAFC' }}>
                    {['Görsel', 'Araç', 'Kap.', 'Durum', 'Aktif', 'Öne Çıkan', 'Sıra', 'Güncellendi', 'İşlem'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', color: '#718596', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const neverPublished = !v.publishedAt && ['DRAFT', 'RESEARCH', 'REVIEW'].includes(v.status);
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #EDF2F7' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                      >
                        {/* Thumbnail */}
                        <td style={{ padding: '10px 12px' }}>
                          {v.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.coverImage}
                              alt={v.coverImageAlt ?? v.name}
                              style={{ width: '52px', height: '36px', objectFit: 'cover', borderRadius: '4px', background: '#EDF2F7' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: '52px', height: '36px', background: '#EDF2F7', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0B0BC', fontSize: '18px' }}>
                              🚗
                            </div>
                          )}
                        </td>

                        {/* Name */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ color: '#172B3A', fontWeight: 500 }}>{v.name}</div>
                          {v.vehicleType && (
                            <div style={{ color: '#718596', fontSize: '11px', marginTop: '2px' }}>{v.vehicleType}</div>
                          )}
                        </td>

                        {/* Capacity */}
                        <td style={{ padding: '10px 12px', color: '#718596', whiteSpace: 'nowrap' }}>
                          {v.passengerCapacity != null ? `${v.passengerCapacity} yolcu` : '—'}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '10px 12px' }}>
                          <StatusBadge status={v.status as ContentStatus} size="sm" />
                        </td>

                        {/* Active */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: v.isActive ? '#047857' : '#718596', fontSize: '12px', fontWeight: 600 }}>
                            {v.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>

                        {/* Featured */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {v.isFeatured ? (
                            <span style={{ color: GOLD, fontSize: '15px' }}>★</span>
                          ) : (
                            <span style={{ color: '#D8E1E9', fontSize: '15px' }}>☆</span>
                          )}
                        </td>

                        {/* Display order */}
                        <td style={{ padding: '10px 12px', color: '#718596' }}>{v.displayOrder}</td>

                        {/* Updated at */}
                        <td style={{ padding: '10px 12px', color: '#718596', whiteSpace: 'nowrap' }}>
                          {formatDate(v.updatedAt)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <Link
                              href={`/admin/araclar/${v.id}/duzenle`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                background: '#EFF6FF',
                                color: '#2563EB',
                                fontSize: '12px',
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 500,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Düzenle
                            </Link>

                            {v.status !== 'ARCHIVED' && (
                              <button
                                onClick={() => setActive(v.id, !v.isActive)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  background: v.isActive ? '#F8FAFC' : '#ECFDF5',
                                  border: '1px solid #D8E1E9',
                                  color: v.isActive ? '#52697A' : '#047857',
                                  fontSize: '12px',
                                  fontFamily: 'Inter, sans-serif',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {v.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                              </button>
                            )}

                            {v.status !== 'ARCHIVED' && (
                              <button
                                onClick={() => confirmArchive(v)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  background: '#FEF2F2',
                                  border: 'none',
                                  color: '#D64545',
                                  fontSize: '12px',
                                  fontFamily: 'Inter, sans-serif',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Arşivle
                              </button>
                            )}

                            {neverPublished && (
                              <button
                                onClick={() => confirmDelete(v)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  background: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  color: '#D64545',
                                  fontSize: '12px',
                                  fontFamily: 'Inter, sans-serif',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D8E1E9',
                  borderRadius: '6px',
                  color: page === 1 ? '#D8E1E9' : '#52697A',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                ← Önceki
              </button>
              <span style={{ color: '#718596', fontSize: '12px', fontFamily: 'Inter, sans-serif', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D8E1E9',
                  borderRadius: '6px',
                  color: page === totalPages ? '#D8E1E9' : '#52697A',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirmation dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
