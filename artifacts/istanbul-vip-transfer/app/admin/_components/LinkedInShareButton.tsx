'use client';

import type { CSSProperties } from 'react';
import { ExternalLink, Linkedin } from 'lucide-react';
import { buildLinkedInShareUrl } from '@/lib/linkedin-share-intent';

type LinkedInShareButtonProps = {
  url: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
  style?: CSSProperties;
};

/** Opens LinkedIn's browser share dialog; no OAuth token or API access is used. */
export default function LinkedInShareButton({
  url,
  label = "LinkedIn'de Paylaş",
  disabled = false,
  disabledHint = 'Yalnızca yayındaki içerikler paylaşılabilir.',
  style,
}: LinkedInShareButtonProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: '1px solid #0A66C2', borderRadius: 7, padding: '7px 10px',
    background: '#0A66C2', color: '#FFFFFF', fontFamily: 'Inter, sans-serif',
    fontSize: 11, fontWeight: 700, textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    ...style,
  };

  if (disabled) {
    return <span aria-disabled="true" title={disabledHint} data-testid="linkedin-share-button-disabled" style={baseStyle}>
      <Linkedin size={13} aria-hidden="true" /> {label}
    </span>;
  }

  return (
    <a href={buildLinkedInShareUrl(url)} target="_blank" rel="noopener noreferrer"
      title="LinkedIn paylaşım ekranını yeni sekmede aç" data-testid="linkedin-share-button"
      data-share-url={url} style={baseStyle}>
      <Linkedin size={13} aria-hidden="true" /> {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}