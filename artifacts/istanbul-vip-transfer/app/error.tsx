'use client';

/**
 * app/error.tsx — Route segment error boundary (App Router).
 *
 * Rendered when an unexpected error is thrown in any child route below `app/`.
 * Must be a client component.  The raw error is logged server-side only;
 * users see a friendly branded message.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging already captures the stack; this catches client-side
    // errors in browser console without leaking details to the UI.
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F3F6FA',
      fontFamily: 'Inter, sans-serif',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: 'center',
      }}>
        {/* Brand mark */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem',
          padding: '0.6rem 1.2rem',
          background: '#102A43',
          borderRadius: '999px',
        }}>
          <span style={{ fontSize: '1rem' }}>✦</span>
          <span style={{ color: '#C99A32', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em' }}>
            VIP Transfer
          </span>
        </div>

        {/* Error code */}
        <p style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#C99A32',
          marginBottom: '0.75rem',
        }}>
          Beklenmeyen Bir Hata
        </p>

        {/* Heading */}
        <h1 style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 700,
          color: '#102A43',
          marginBottom: '1rem',
          lineHeight: 1.25,
        }}>
          Bir şeyler ters gitti
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '0.95rem',
          color: '#50677A',
          lineHeight: 1.7,
          marginBottom: '2rem',
        }}>
          İşleminiz gerçekleştirilirken beklenmeyen bir hata oluştu.
          Tekrar deneyebilir ya da ana sayfaya dönebilirsiniz.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.7rem 1.5rem',
              background: '#C99A32',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Tekrar Dene
          </button>
          <Link
            href="/"
            style={{
              padding: '0.7rem 1.5rem',
              background: 'transparent',
              color: '#102A43',
              border: '1.5px solid #D9E2EC',
              borderRadius: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
