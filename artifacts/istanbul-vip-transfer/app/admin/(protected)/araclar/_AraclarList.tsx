'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Vehicle } from '@/db/schema';
import type { ContentStatus } from '@/lib/workflow';
import { STATUS_LABELS } from '@/lib/workflow';
import StatusBadge from '../../_components/StatusBadge';
import { AdminRecordActions } from '../../_components/AdminRecordActions';
import { AdminCmsRecordCard } from '../../_components/AdminCmsRecordCard';

const GOLD = '#C99A32';

const ALL_STATUSES: ContentStatus[] = [
  'DRAFT', 'RESEARCH', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED',
];

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
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
            disabled={loading}
            style={{
              background: '#FFFFFF',
              border: '1px solid #D8E1E9',
              borderRadius: '8px',
              color: '#52697A',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px 18px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: danger ? '#FEF2F2' : '#2563EB',
              border: danger ? '1px solid #FECACA' : 'none',
              borderRadius: '8px',
              color: danger ? '#D64545' : '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px 18px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
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
  minHeight: '44px',
  outline: 'none',
};

export default function AraclarList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Ordering controls operate on the same ordered peer list shown to the admin.
  const [sort, setSort] = useState<'updatedAt' | 'displayOrder'>('displayOrder');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
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
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  function confirmDelete(v: Vehicle) {
    setActionError('');
    setConfirm({
      title: 'Aracı Kalıcı Sil',
      message: `"${v.name}" aracı kalıcı olarak silinecektir. Bu işlem geri alınamaz. Hiç yayınlanmamış taslak araçlar için geçerlidir.`,
      confirmLabel: 'Kalıcı Sil',
      danger: true,
      onConfirm: () => doDelete(v.id),
    });
  }

  async function doDelete(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/admin/api/vehicles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError(json.error ?? 'Silme başarısız.');
      } else {
        await fetchVehicles();
      }
    } catch {
      setActionError('Bağlantı hatası.');
    } finally {
      setActionLoading(null);
      setConfirm(null);
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
    }
  }

  async function reorder(vehicle: Vehicle, direction: 'up' | 'down') {
    setOrderingId(vehicle.id);
    setActionError('');
    try {
      const res = await fetch(`/admin/api/vehicles/${vehicle.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: direction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Sıralama güncellenemedi.');
      setVehicles((current) => {
        const index = current.findIndex((item) => item.id === vehicle.id);
        const peerIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || peerIndex < 0 || peerIndex >= current.length) return current;
        const next = [...current];
        [next[index], next[peerIndex]] = [next[peerIndex], next[index]];
        return next;
      });
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Sıralama güncellenemedi.'); }
    finally { setOrderingId(null); }
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
           <div data-admin-record-list="true" style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
             {vehicles.map((v) => (
               <AdminCmsRecordCard
                 key={v.id}
                 title={v.name}
                 description={v.vehicleType ?? undefined}
                 status={<StatusBadge status={v.status as ContentStatus} size="sm" />}
               >
                 <div className="grid w-full min-w-0 grid-cols-2 gap-3 text-xs text-slate-500 min-[769px]:grid-cols-4">
                   <div className="flex min-w-0 items-center gap-2">
                     {v.coverImage ? (
                       // eslint-disable-next-line @next/next/no-img-element
                       <img src={v.coverImage} alt={v.coverImageAlt ?? v.name} className="h-9 w-[52px] shrink-0 rounded object-cover bg-slate-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                     ) : <span className="flex h-9 w-[52px] shrink-0 items-center justify-center rounded bg-slate-100 text-lg">🚗</span>}
                     <span>{v.passengerCapacity != null ? `${v.passengerCapacity} yolcu` : '—'}</span>
                   </div>
                   <div><span className="font-medium text-slate-700">Aktiflik:</span> {v.isActive ? 'Aktif' : 'Pasif'}</div>
                   <div><span className="font-medium text-slate-700">Öne Çıkan:</span> {v.isFeatured ? 'Evet' : 'Hayır'}</div>
                   <div><span className="font-medium text-slate-700">Sıra:</span> {v.displayOrder} · {formatDate(v.updatedAt)}</div>
                 </div>
                 <div data-admin-record-actions-row="true" className="flex w-full min-w-0 justify-end">
                          <AdminRecordActions
                            up={{
                              onClick: () => reorder(v, 'up'),
                              disabled: v.status === 'ARCHIVED' || orderingId === v.id || vehicles.indexOf(v) === 0,
                              disabledReason: v.status === 'ARCHIVED' ? "Arşivlenmiş araç sıralanamaz." : vehicles.indexOf(v) === 0 ? "Listenin en üstünde" : undefined
                            }}
                            down={{
                              onClick: () => reorder(v, 'down'),
                              disabled: v.status === 'ARCHIVED' || orderingId === v.id || vehicles.indexOf(v) === vehicles.length - 1,
                              disabledReason: v.status === 'ARCHIVED' ? "Arşivlenmiş araç sıralanamaz." : vehicles.indexOf(v) === vehicles.length - 1 ? "Listenin en altında" : undefined
                            }}
                            edit={{
                              href: `/admin/araclar/${v.id}/duzenle`,
                              disabled: v.status === 'ARCHIVED',
                              disabledReason: v.status === 'ARCHIVED' ? "Düzenlemek için önce arşivden çıkarın." : undefined,
                            }}
                            activation={{
                              disabled: v.status === 'ARCHIVED',
                              disabledReason: v.status === 'ARCHIVED' ? "Durumu değiştirmek için önce arşivden çıkarın." : undefined,
                              isActive: v.isActive,
                              onClick: () => setActive(v.id, !v.isActive)
                            }}
                            delete={{
                              onClick: () => confirmDelete(v),
                              disabled: v.isActive || v.publishedAt !== null || !['DRAFT', 'RESEARCH', 'REVIEW', 'ARCHIVED'].includes(v.status),
                              disabledReason: v.isActive
                                ? "Aktif araçlar kalıcı silinemez. Lütfen önce pasifleştirin."
                                : v.publishedAt !== null
                                  ? "Yayınlanmış araçlar kalıcı silinemez. Lütfen arşivleyin."
                                  : !['DRAFT', 'RESEARCH', 'REVIEW', 'ARCHIVED'].includes(v.status)
                                    ? "Yalnızca hiç yayınlanmamış taslak, inceleme veya arşiv kayıtları kalıcı silinebilir."
                                  : undefined,
                            }}
                          />
                 </div>
               </AdminCmsRecordCard>
             ))}
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
          loading={!!actionLoading}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
