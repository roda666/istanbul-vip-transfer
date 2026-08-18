'use client';

/**
 * GoogleAnalyticsConsent
 *
 * Loads GA4 only AFTER the visitor has accepted cookies via the
 * CookieConsentBanner. On mount it checks the `ivt_cookie_consent` cookie;
 * if already accepted it renders the Script tags immediately. Otherwise it
 * waits for the `ivt:consent:accepted` custom event dispatched by the banner.
 *
 * If the cookie value is 'rejected' (or any value ≠ 'accepted') GA is never
 * loaded for that session / until the user accepts on a future visit.
 */

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { GA_ID } from '@/lib/analytics';

const COOKIE_NAME  = 'ivt_cookie_consent';
const COOKIE_VALUE = 'accepted';

function readConsentCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some(r => r === `${COOKIE_NAME}=${COOKIE_VALUE}`);
}

export default function GoogleAnalyticsConsent() {
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    // Immediately grant if cookie is already set to 'accepted'
    if (readConsentCookie()) {
      setConsent(true);
      return;
    }

    // Otherwise wait for the banner's accept event
    function onAccepted() { setConsent(true); }
    window.addEventListener('ivt:consent:accepted', onAccepted);
    return () => window.removeEventListener('ivt:consent:accepted', onAccepted);
  }, []);

  if (!consent) return null;

  return (
    <>
      {/* Load the gtag.js collector */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* Initialise GA4 config */}
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
