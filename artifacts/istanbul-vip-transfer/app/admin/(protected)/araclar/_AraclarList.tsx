'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Vehicle } from '@/db/schema';
import type { ContentStatus } from '@/lib/workflow';
import { STATUS_LABELS } from '@/lib/workflow';
import StatusBadge from '../../_components/StatusBadge';

const GOLD = '#C9A84C';
const BORDER = 'rgba(201,168,76,0.12)';

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
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#181818',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '440px',
          width: '100%',
        }}
      >
        <h3
          style={{
            color: '#fff',
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
            color: '#888',
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
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '8px',
              color: '#777',
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
              background: danger ? 'rgba(239,68,68,0.15)' : GOLD,
              border: danger ? '1px solid rgba(239,68,68,0.3)' : 'none',
              borderRadius: '8px',
              color: danger ? '#f87171' : '#0A0A0A',
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

  // Reset page on filter/sort change
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

  function formatDate(d: Date | string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      {/* ── Filters ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '20px',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Araç adı ara..."
          style={{
            flex: '1 1 200px',
            minWidth: '160px',
            background: '#1a1a1a',
            border: `1px solid ${BORDER}`,
            borderRadius: '6px',
            color: '#ddd',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            padding: '8px 12px',
            outline: 'none',
          }}
        />

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: '#1a1a1a',
            border: `1px solid ${BORDER}`,
            borderRadius: '6px',
            color: '#ddd',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            padding: '8px 12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">Tüm Durumlar</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={`${sort}_${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split('_') as [typeof sort, typeof order];
            setSort(s); setOrder(o);
          }}
          style={{
            background: '#1a1a1a',
            border: `1px solid ${BORDER}`,
            borderRadius: '6px',
            color: '#ddd',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            padding: '8px 12px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="updatedAt_desc">Son Güncelleme (Yeni)</option>
          <option value="updatedAt_asc">Son Güncelleme (Eski)</option>
          <option value="displayOrder_asc">Sıra (Artan)</option>
          <option value="displayOrder_desc">Sıra (Azalan)</option>
        </select>
      </div>

      {/* ── Action error ── */}
      {actionError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#f87171',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            marginBottom: '16px',
          }}
        >
          {actionError}
        </div>
      )}

      {/* ── Loading / Error / Empty ── */}
      {loading ? (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '48px 0', textAlign: 'center' }}>
          Yükleniyor...
        </div>
      ) : error ? (
        <div style={{ color: '#f87171', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{error}</div>
      ) : vehicles.length === 0 ? (
        <div
          style={{
            background: '#1a1a1a',
            border: `1px solid ${BORDER}`,
            borderRadius: '10px',
            padding: '60px 32px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#555', fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
            {search || statusFilter
              ? 'Bu filtreye uyan araç bulunamadı.'
              : 'Henüz araç eklenmedi. İlk aracı eklemek için "Yeni Araç Ekle" butonunu kullanın.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Görsel', 'Araç', 'Kap.', 'Durum', 'Öne Çıkan', 'Sıra', 'Güncellendi', 'İşlem'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 12px',
                          color: '#555',
                          fontWeight: 500,
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const neverPublished = !v.publishedAt && ['DRAFT', 'RESEARCH', 'REVIEW'].includes(v.status);
                  return (
                    <tr
                      key={v.id}
                      style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}
                    >
                      {/* Thumbnail */}
                      <td style={{ padding: '10px 12px' }}>
                        {v.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.coverImage}
                            alt={v.coverImageAlt ?? v.name}
                            style={{ width: '52px', height: '36px', objectFit: 'cover', borderRadius: '4px', background: '#222' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '52px',
                              height: '36px',
                              background: '#222',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#444',
                              fontSize: '18px',
                            }}
                          >
                            🚗
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: '#ddd', fontWeight: 500 }}>{v.name}</div>
                        {v.vehicleType && (
                          <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{v.vehicleType}</div>
                        )}
                      </td>

                      {/* Capacity */}
                      <td style={{ padding: '10px 12px', color: '#888', whiteSpace: 'nowrap' }}>
                        {v.passengerCapacity != null ? `${v.passengerCapacity} yolcu` : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={v.status as ContentStatus} size="sm" />
                      </td>

                      {/* Featured */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {v.isFeatured ? (
                          <span style={{ color: GOLD, fontSize: '15px' }}>★</span>
                        ) : (
                          <span style={{ color: '#333', fontSize: '15px' }}>☆</span>
                        )}
                      </td>

                      {/* Display order */}
                      <td style={{ padding: '10px 12px', color: '#666' }}>{v.displayOrder}</td>

                      {/* Updated at */}
                      <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>
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
                              background: 'rgba(201,168,76,0.08)',
                              color: GOLD,
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
                              onClick={() => confirmArchive(v)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                background: 'rgba(239,68,68,0.08)',
                                border: 'none',
                                color: '#f87171',
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
                                background: 'rgba(239,68,68,0.05)',
                                border: '1px solid rgba(239,68,68,0.15)',
                                color: '#ef4444',
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: '#1a1a1a',
                  border: `1px solid ${BORDER}`,
                  borderRadius: '6px',
                  color: page === 1 ? '#333' : '#888',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                ← Önceki
              </button>
              <span style={{ color: '#555', fontSize: '12px', fontFamily: 'Inter, sans-serif', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: '#1a1a1a',
                  border: `1px solid ${BORDER}`,
                  borderRadius: '6px',
                  color: page === totalPages ? '#333' : '#888',
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
