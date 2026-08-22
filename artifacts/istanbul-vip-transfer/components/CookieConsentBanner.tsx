'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/lib/i18n/context';
import { localizedPublicPath } from '@/lib/localized-service-path';
import Link from 'next/link';

const COOKIE_NAME  = 'ivt_cookie_consent';
const COOKIE_VALUE = 'accepted';
const COOKIE_REJECT = 'rejected';
const MAX_AGE_SECS = 365 * 24 * 3600; // 1 year

// Reject button labels per locale — avoids updating 9 dict files for one word
const REJECT_LABELS: Record<string, string> = {
  tr: 'Reddet', en: 'Decline', de: 'Ablehnen', ru: 'Отклонить',
  ar: 'رفض',   es: 'Rechazar', fr: 'Refuser',  it: 'Rifiuta', nl: 'Weigeren',
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function CookieConsentBanner({
  hasInitialDecision,
}: {
  /** Determined server-side from the consent cookie for first-paint stability. */
  hasInitialDecision: boolean;
}) {
  const { lang, dict } = useLang();
  const [visible, setVisible] = useState(!hasInitialDecision);

  useEffect(() => {
    // Re-check during hydration in case a consent cookie changed between the
    // request and client boot. New visitors see the server-rendered banner.
    const current = getCookie(COOKIE_NAME);
    setVisible(!current);
  }, [hasInitialDecision]);

  if (!visible) return null;

  const accept = () => {
    setCookie(COOKIE_NAME, COOKIE_VALUE, MAX_AGE_SECS);
    setVisible(false);
    // Notify GoogleAnalyticsConsent that scripts can now be loaded
    window.dispatchEvent(new CustomEvent('ivt:consent:accepted'));
  };

  const reject = () => {
    setCookie(COOKIE_NAME, COOKIE_REJECT, MAX_AGE_SECS);
    setVisible(false);
    // No event dispatched → GA stays unloaded
  };

  const lp = (path: string) => localizedPublicPath(path, lang);

  return (
    <div
      role="dialog"
      aria-label={dict.common.cookieBannerAccept}
      style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        zIndex:       9999,
        background:   '#102A43',
        borderTop:    '1px solid rgba(201,168,76,0.35)',
        padding:      '12px 20px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        gap:          '16px',
        flexWrap:     'wrap',
        boxShadow:    '0 -4px 24px rgba(0,0,0,0.25)',
      }}
    >
      <p
        style={{
          color:      'rgba(255,255,255,0.80)',
          fontFamily: 'Inter, sans-serif',
          fontSize:   '12px',
          margin:     0,
          flex:       '0 1 280px',
          maxWidth:   '280px',
          lineHeight: 1.5,
        }}
      >
        {dict.common.cookieBannerText}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <Link
          href={lp('/yasal/cerez-politikasi')}
          style={{
            color:      'rgba(255,255,255,0.55)',
            fontFamily: 'Inter, sans-serif',
            fontSize:   '12px',
            textDecoration: 'underline',
            whiteSpace: 'nowrap',
          }}
        >
          {dict.common.cookieBannerDetails}
        </Link>

        {/* Reject — sets rejected cookie, GA stays unloaded */}
        <button
          onClick={reject}
          style={{
            background:   'transparent',
            color:        'rgba(255,255,255,0.60)',
            border:       '1px solid rgba(255,255,255,0.25)',
            borderRadius: '6px',
            padding:      '7px 14px',
            fontFamily:   'Inter, sans-serif',
            fontSize:     '13px',
            fontWeight:   500,
            cursor:       'pointer',
            whiteSpace:   'nowrap',
          }}
        >
          {REJECT_LABELS[lang] ?? 'Decline'}
        </button>

        {/* Accept — sets accepted cookie and signals GA to load */}
        <button
          onClick={accept}
          style={{
            background:   '#C9A84C',
            color:        '#102A43',
            border:       'none',
            borderRadius: '6px',
            padding:      '8px 18px',
            fontFamily:   'Inter, sans-serif',
            fontSize:     '13px',
            fontWeight:   600,
            cursor:       'pointer',
            whiteSpace:   'nowrap',
          }}
        >
          {dict.common.cookieBannerAccept}
        </button>
      </div>
    </div>
  );
}
