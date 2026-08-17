'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/lib/i18n/context';
import { localePath } from '@/lib/locale-path';
import Link from 'next/link';

const COOKIE_NAME  = 'ivt_cookie_consent';
const COOKIE_VALUE = 'accepted';
const MAX_AGE_SECS = 365 * 24 * 3600; // 1 year

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

export default function CookieConsentBanner() {
  const { lang, dict } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookie(COOKIE_NAME) !== COOKIE_VALUE) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    setCookie(COOKIE_NAME, COOKIE_VALUE, MAX_AGE_SECS);
    setVisible(false);
  };

  const lp = (path: string) => localePath(path, lang);

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
        padding:      '16px 20px',
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
          fontSize:   '13px',
          margin:     0,
          flex:       '1 1 240px',
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
