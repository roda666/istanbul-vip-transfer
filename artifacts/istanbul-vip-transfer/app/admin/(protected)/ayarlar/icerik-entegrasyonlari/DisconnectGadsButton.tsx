'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminActionButton } from '../../../_components/AdminActionButton';

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
    <AdminActionButton label={loading ? 'Kesiliyor…' : 'Bağlantıyı Kes'} variant="delete" loading={loading} onClick={handle} />
  );
}
