'use client';

/**
 * app/global-error.tsx — Root layout error boundary (App Router).
 *
 * Rendered when an error is thrown in the root layout itself (e.g. a
 * provider crash), replacing the entire document.  Must include its own
 * <html> and <body> tags.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hata — Istanbul VIP Transfer</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #F3F6FA;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .wrap { max-width: 460px; text-align: center; }
          .brand {
            display: inline-flex; align-items: center; gap: 0.5rem;
            padding: 0.6rem 1.2rem; background: #102A43; border-radius: 999px;
            margin-bottom: 2rem;
          }
          .brand-name { color: #C99A32; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.04em; }
          .label {
            font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em;
            text-transform: uppercase; color: #C99A32; margin-bottom: 0.75rem;
          }
          h1 { font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 700; color: #102A43; margin-bottom: 1rem; line-height: 1.25; }
          p  { font-size: 0.95rem; color: #50677A; line-height: 1.7; margin-bottom: 2rem; }
          .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
          button {
            padding: 0.7rem 1.5rem; background: #C99A32; color: #fff;
            border: none; border-radius: 0.5rem; font-weight: 600; font-size: 0.9rem;
            cursor: pointer; font-family: inherit;
          }
          a {
            padding: 0.7rem 1.5rem; color: #102A43;
            border: 1.5px solid #D9E2EC; border-radius: 0.5rem; font-weight: 500;
            font-size: 0.9rem; text-decoration: none; display: inline-block;
          }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="brand">
            <span>✦</span>
            <span className="brand-name">VIP Transfer</span>
          </div>
          <p className="label">Kritik Hata</p>
          <h1>Uygulama başlatılamadı</h1>
          <p>
            Beklenmeyen bir sorun nedeniyle sayfa yüklenemedi.
            Lütfen sayfayı yenileyerek tekrar deneyin.
          </p>
          <div className="actions">
            <button onClick={reset}>Sayfayı Yenile</button>
            <a href="/">Ana Sayfaya Dön</a>
          </div>
        </div>
      </body>
    </html>
  );
}
