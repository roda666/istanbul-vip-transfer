'use client';

import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import { buildFacebookShareUrl } from '@/lib/facebook-share-intent';

type FacebookShareButtonProps = {
  url: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
  style?: CSSProperties;
};

/**
 * Opens Facebook's official browser share dialog without requiring an API
 * connection, OAuth token, or a server-side publish request.
 */
export default function FacebookShareButton({
  url,
  label = "Facebook'ta Paylaş",
  disabled = false,
  disabledHint = 'Yalnızca yayındaki içerikler paylaşılabilir.',
  style,
}: FacebookShareButtonProps) {
  const shareUrl = buildFacebookShareUrl(url);
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: '1px solid #1877F2',
    borderRadius: 7,
    padding: '7px 10px',
    background: '#1877F2',
    color: '#FFFFFF',
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title={disabledHint}
        data-testid="facebook-share-button-disabled"
        style={baseStyle}
      >
        <span aria-hidden="true">f</span> {label}
      </span>
    );
  }

  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Facebook paylaşım ekranını yeni sekmede aç"
      data-testid="facebook-share-button"
      data-share-url={url}
      style={baseStyle}
    >
      <span aria-hidden="true">f</span> {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}