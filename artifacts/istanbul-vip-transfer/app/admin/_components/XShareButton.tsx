'use client';

import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import { buildXShareIntentUrl } from '@/lib/x-share-intent';

type XShareButtonProps = {
  title: string;
  summary?: string | null;
  url: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
  style?: CSSProperties;
};

/**
 * A no-token X share action. The visitor's existing X session handles the
 * share in a new tab through X's official web intent.
 */
export default function XShareButton({
  title,
  summary,
  url,
  label = "X'te Paylaş",
  disabled = false,
  disabledHint = 'Yalnızca yayındaki içerikler paylaşılabilir.',
  style,
}: XShareButtonProps) {
  const intentUrl = buildXShareIntentUrl({ title, summary, url });
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: '1px solid #172B3A',
    borderRadius: 7,
    padding: '7px 10px',
    background: '#172B3A',
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
        data-testid="x-share-button-disabled"
        style={baseStyle}
      >
        <span aria-hidden="true">𝕏</span> {label}
      </span>
    );
  }

  return (
    <a
      href={intentUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="X paylaşım ekranını yeni sekmede aç"
      data-testid="x-share-button"
      data-share-url={url}
      style={baseStyle}
    >
      <span aria-hidden="true">𝕏</span> {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}