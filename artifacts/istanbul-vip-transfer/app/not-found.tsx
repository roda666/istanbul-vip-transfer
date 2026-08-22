/**
 * app/not-found.tsx — Root 404 page (App Router).
 *
 * Shown when a URL does not match any route at the root level.
 * Turkish fallback — locale-aware 404s live in app/[lang]/not-found.tsx.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getDictionary } from '@/lib/i18n';
import { localizedPublicPath } from '@/lib/localized-service-path';

export const metadata: Metadata = {
  title: 'Sayfa Bulunamadı — Istanbul VIP Transfer',
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const requestedLang = (await headers()).get('x-ivt-lang') ?? 'tr';
  const dict = getDictionary(requestedLang);
  const homePath = localizedPublicPath('/', requestedLang);
  const contactPath = localizedPublicPath('/iletisim', requestedLang);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #0B1F33 0%, #102A43 60%, #1a3a5c 100%)',
      fontFamily: 'Inter, sans-serif',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>

        {/* Brand mark */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2.5rem',
          padding: '0.6rem 1.2rem',
          background: 'rgba(201,154,50,0.15)',
          border: '1px solid rgba(201,154,50,0.3)',
          borderRadius: '999px',
        }}>
          <span style={{ color: '#C99A32', fontSize: '0.9rem' }}>✦</span>
          <span style={{ color: '#C99A32', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em' }}>
            Istanbul VIP Transfer
          </span>
        </div>

        {/* 404 */}
        <div style={{
          fontSize: 'clamp(5rem, 18vw, 8rem)',
          fontWeight: 800,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #C99A32 0%, #e8c46a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
          letterSpacing: '-0.02em',
        }}>
          404
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 'clamp(1.25rem, 3.5vw, 1.75rem)',
          fontWeight: 700,
          color: '#fff',
          marginBottom: '1rem',
          lineHeight: 1.3,
        }}>
          {dict.common.notFound}
        </h1>

        {/* Sub-message */}
        <p style={{
          fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.75,
          marginBottom: '2.5rem',
          maxWidth: 400,
          margin: '0 auto 2.5rem',
        }}>
          {dict.common.error} {dict.common.contactUs}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href={homePath}
            style={{
              padding: '0.8rem 1.75rem',
              background: '#C99A32',
              color: '#fff',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-block',
              letterSpacing: '0.02em',
            }}
          >
            {dict.nav.home}
          </Link>
          <Link
            href={contactPath}
            style={{
              padding: '0.8rem 1.75rem',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {dict.nav.contact}
          </Link>
        </div>

      </div>
    </div>
  );
}
