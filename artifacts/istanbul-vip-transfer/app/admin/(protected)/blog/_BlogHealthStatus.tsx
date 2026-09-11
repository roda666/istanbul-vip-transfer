import React from 'react';

interface BlogHealthStatusProps {
  checkedAt: Date | null;
  unhealthyCount: number | null;
}

export default function BlogHealthStatus({ checkedAt, unhealthyCount }: BlogHealthStatusProps) {
  if (!checkedAt) return null;

  const healthy = unhealthyCount === 0;
  return (
    <div style={{
      marginBottom: '12px',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1px solid ${healthy ? '#BBF7D0' : '#FDE68A'}`,
      background: healthy ? '#F0FDF4' : '#FFFBEB',
      color: healthy ? '#166534' : '#92400E',
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
    }}>
      <strong>{healthy ? 'Otomatik blog kontrolü sağlıklı' : `${unhealthyCount ?? 0} sorun son otomatik kontrolde kaydedildi`}</strong>
      {' · Son otomatik kontrol: '}
      {new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(checkedAt)}
    </div>
  );
}