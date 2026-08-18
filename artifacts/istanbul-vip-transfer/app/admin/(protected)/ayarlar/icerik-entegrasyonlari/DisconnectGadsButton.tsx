'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DisconnectGadsButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm('Google Ads bağlantısını kesmek istediğinizden emin misiniz?')) return;
    setLoading(true);
    try {
      await fetch('/admin/api/google-ads/disconnect', { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      style={{
        padding: '8px 16px', borderRadius: '8px',
        border: '1px solid #FECACA', background: '#FEF2F2',
        color: '#DC2626', fontSize: '13px', fontWeight: 600,
        fontFamily: 'Inter, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Kesiliyor…' : 'Bağlantıyı Kes'}
    </button>
  );
}
