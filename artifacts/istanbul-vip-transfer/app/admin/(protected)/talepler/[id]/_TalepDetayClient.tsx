'use client';

import { useState } from 'react';
import { Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, string> = {
  NEW:       'Yeni',
  CONTACTED: 'İletişimde',
  QUOTED:    'Teklife Gönderildi',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  SPAM:      'Spam',
};

interface Props {
  requestId: string;
  currentStatus: string;
  archivedAt: string | null;
}

export default function TalepDetayClient({ requestId, currentStatus, archivedAt }: Props) {
  const [status, setStatus]   = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const router = useRouter();

  async function save(newStatus: string) {
    setLoading(true);
    setSaved(false);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      setSaved(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function archive() {
    if (!confirm('Bu talebi arşivlemek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await fetch(`/admin/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8', display: 'block', marginBottom: '8px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>
        Durum
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={status}
          disabled={loading || !!archivedAt}
          onChange={(e) => save(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB',
            fontSize: '13px', fontFamily: 'Inter, sans-serif', background: '#FFFFFF', cursor: 'pointer',
          }}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {saved && <span style={{ fontSize: '12px', color: '#15803D', fontFamily: 'Inter, sans-serif' }}>✓ Kaydedildi</span>}
      </div>

      {!archivedAt && (
        <button
          onClick={archive}
          disabled={loading}
          style={{
            marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
            background: '#F8FAFC', color: '#64748B', fontSize: '12px', fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          <Archive size={13} /> Arşivle
        </button>
      )}
      {archivedAt && (
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
          Arşivlenmiş talep.
        </p>
      )}
    </div>
  );
}
