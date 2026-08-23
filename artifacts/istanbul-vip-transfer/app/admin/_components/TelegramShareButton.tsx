'use client';

import type { CSSProperties } from 'react';
import { ExternalLink, Send } from 'lucide-react';
import { buildTelegramShareUrl } from '@/lib/telegram-share-intent';

type TelegramShareButtonProps = {
  title: string;
  url: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
  style?: CSSProperties;
};

/** Opens Telegram's official browser share dialog without a bot or API access. */
export default function TelegramShareButton({
  title,
  url,
  label = "Telegram'da Paylaş",
  disabled = false,
  disabledHint = 'Yalnızca yayındaki içerikler paylaşılabilir.',
  style,
}: TelegramShareButtonProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: '1px solid #229ED9', borderRadius: 7, padding: '7px 10px',
    background: '#229ED9', color: '#FFFFFF', fontFamily: 'Inter, sans-serif',
    fontSize: 11, fontWeight: 700, textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    ...style,
  };

  if (disabled) {
    return <span aria-disabled="true" title={disabledHint} data-testid="telegram-share-button-disabled" style={baseStyle}>
      <Send size={13} aria-hidden="true" /> {label}
    </span>;
  }

  return (
    <a href={buildTelegramShareUrl({ title, url })} target="_blank" rel="noopener noreferrer"
      title="Telegram paylaşım ekranını yeni sekmede aç" data-testid="telegram-share-button"
      data-share-url={url} style={baseStyle}>
      <Send size={13} aria-hidden="true" /> {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}