'use client';

import { LogOut } from 'lucide-react';

export default function DisconnectGscButton() {
  return (
    <button
      onClick={async () => {
        if (!confirm('GSC bağlantısını kesmek istediğinizden emin misiniz?')) return;
        const res = await fetch('/admin/api/gsc/insights', { method: 'DELETE' });
        if (res.ok) window.location.reload();
        else alert('Bağlantı kesilirken hata oluştu.');
      }}
      style={{
        padding: '8px 16px', borderRadius: '8px',
        border: '1px solid #FECACA', background: '#FEF2F2', color: '#D64545',
        fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}
    >
      <LogOut size={14} />
      Bağlantıyı Kes
    </button>
  );
}
