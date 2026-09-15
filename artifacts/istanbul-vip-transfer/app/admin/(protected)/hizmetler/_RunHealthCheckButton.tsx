'use client';

import { useState } from 'react';
import { AdminActionButton } from '../../_components/AdminActionButton';
import { Activity } from 'lucide-react';

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
       const body = await res.json().catch(() => ({})) as { message?: string; error?: string; emailDelivery?: string };
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
      <AdminActionButton
        label={loading ? 'Kontrol ediliyor…' : status === 'ok' ? 'E-posta kabul edildi' : status === 'error' ? 'Kontrol edilemedi' : 'Şimdi kontrol et'}
        icon={Activity}
        variant={status === 'error' ? 'delete' : status === 'ok' ? 'activate' : 'subtle'}
        loading={loading}
        onClick={handleClick}
      />
      {message && (
        <span role="status" style={{ color: status === 'error' ? '#B42318' : '#50677A', fontSize: '12px', maxWidth: '360px' }}>
          {message}
        </span>
      )}
    </div>
  );
}
