'use client';

import { useState } from 'react';

/**
 * Client component that triggers a manual health check via POST
 * /admin/api/service-pages/check and refreshes the page afterwards.
 */
export default function RunHealthCheckButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setStatus('idle');
    setMessage(null);
    try {
      const res = await fetch('/admin/api/service-pages/check', { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (res.ok) {
        setStatus('ok');
        setMessage(body.message ?? 'Kontrol tamamlandı.');
        // Refresh server component data so the "last checked at" timestamp updates
        setTimeout(() => window.location.reload(), 800);
      } else {
        setStatus('error');
        setMessage(body.error ?? 'Kontrol tamamlanamadı.');
      }
    } catch {
      setStatus('error');
      setMessage('Kontrol tamamlanamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          minHeight: '40px', padding: '6px 14px',
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
              ? '✗ Kontrol edilemedi'
              : '▶ Şimdi kontrol et'}
      </button>
      {message && (
        <span role="status" style={{ color: status === 'error' ? '#B42318' : '#50677A', fontSize: '12px', maxWidth: '360px' }}>
          {message}
        </span>
      )}
    </div>
  );
}
