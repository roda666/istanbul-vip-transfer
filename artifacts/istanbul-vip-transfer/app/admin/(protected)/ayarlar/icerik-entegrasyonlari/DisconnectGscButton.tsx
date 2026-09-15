'use client';

import { LogOut } from 'lucide-react';
import { AdminActionButton } from '../../../_components/AdminActionButton';

export default function DisconnectGscButton() {
  return (
    <AdminActionButton
      label="Bağlantıyı Kes"
      icon={LogOut}
      variant="delete"
      onClick={async () => {
        if (!confirm('GSC bağlantısını kesmek istediğinizden emin misiniz?')) return;
        const res = await fetch('/admin/api/gsc/insights', { method: 'DELETE' });
        if (res.ok) window.location.reload();
        else alert('Bağlantı kesilirken hata oluştu.');
      }}
    />
  );
}
