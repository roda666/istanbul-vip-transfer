'use client';

import { useState } from 'react';

/**
 * Client component that triggers a manual health check via POST
 * /admin/api/service-pages/check and refreshes the page afterwards.
 */
export default function RunHealthCheckButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');

  async function handleClick() {
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch('/admin/api/service-pages/check', { method: 'POST' });
      if (res.ok) {
        setStatus('ok');
        // Refresh server component data so the "last checked at" timestamp updates
        setTimeout(() => window.location.reload(), 800);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 600,
        color: loading ? '#94A3B8' : '#0F766E',
        background: loading ? '#F8FAFC' : '#F0FDFA',
        border: `1px solid ${loading ? '#E2E8F0' : '#99F6E4'}`,
        borderRadius: '8px',
        cursor: loading ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
      }}
    >
      {loading
        ? 'Kontrol ediliyor…'
        : status === 'ok'
          ? '✓ Tamamlandı'
          : status === 'error'
            ? '✗ Hata oluştu'
            : '▶ Şimdi kontrol et'}
    </button>
  );
}
