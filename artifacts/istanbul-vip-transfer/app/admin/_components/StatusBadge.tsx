import { STATUS_LABELS, STATUS_COLORS, type ContentStatus } from '@/lib/workflow';

interface Props {
  status: ContentStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const colors = STATUS_COLORS[status] ?? { bg: '#2a2a2a', text: '#aaa' };
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '6px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.05em',
        background: colors.bg,
        color: colors.text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
