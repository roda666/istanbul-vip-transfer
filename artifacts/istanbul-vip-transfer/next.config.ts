import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Treat nodemailer as a server-external package so Next.js doesn't attempt
  // to bundle it into any browser/fallback bundle.
  serverExternalPackages: ['nodemailer'],

  webpack(config, { isServer }) {
    if (!isServer) {
      // When webpack compiles the client / edge / client-development-fallback
      // bundles it follows the instrumentation.ts import chain and tries to
      // bundle server-only packages (nodemailer, postgres) — which depend on
      // Node.js built-ins (stream, crypto, net, tls…) that don't exist in
      // those bundles.
      //
      // Adding these packages as `externals` tells webpack to stop tracing
      // their dependency graph and instead emit `module.exports = require(…)`
      // at runtime. At runtime these bundles are NEVER executed in a browser —
      // the NEXT_RUNTIME guard in register() ensures they only run in Node.js —
      // so the require() calls succeed.
      const serverOnlyPackages = [
        'nodemailer',
        'postgres',
      ];
      for (const pkg of serverOnlyPackages) {
        config.externals = [
          ...(Array.isArray(config.externals) ? config.externals : []),
          { [pkg]: `commonjs ${pkg}` },
        ];
      }
    }
    return config;
  },
  // Isolate dev and production build output so that running `next build`
  // while the dev server is active never overwrites the dev chunks — which
  // previously caused missing vendor-chunk errors and the "[object Event]"
  // unhandled-rejection in the browser.
  //
  //   next dev   →  writes to .next-dev   (HMR chunks, fast-refresh manifest)
  //   next build →  writes to .next       (production bundles, static pages)
  //   next start →  reads from .next      (production, NODE_ENV=production)
  distDir: isDev ? '.next-dev' : '.next',

  // ── Image optimisation ─────────────────────────────────────────────────────
  // Next.js Image Optimisation is intentionally enabled (no `unoptimized: true`).
  // This converts public/ images to WebP/AVIF, applies responsive sizing and
  // automatic lazy-loading — directly improving LCP, CLS and bandwidth.
  //
  // remotePatterns covers:
  //   • storage.googleapis.com — Replit Object Storage (admin-uploaded images)
  //   • **.replit.dev          — Replit preview domains (dev/staging uploads)
  //
  // Blog hero images entered by admin as arbitrary external URLs are kept as
  // plain <img> elements with loading="lazy" (see app/blog and app/[lang]/blog)
  // so they are not subject to remotePatterns validation.
  images: {
    formats:     ['image/avif', 'image/webp'],
    deviceSizes: [320, 390, 640, 768, 1024, 1280, 1440, 1920],
    imageSizes:  [64, 128, 256, 384],
    remotePatterns: [
      // Replit Object Storage (GCS) — admin-uploaded hero/media images
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      // Replit preview/dev domains
      { protocol: 'https', hostname: '**.replit.dev' },
    ],
  },
  // allowedDevOrigins expects bare hostnames (no scheme).
  // Next.js parses the incoming Origin header, extracts .hostname,
  // and matches that against this list — so "https://host" never matches.
  // "**.replit.dev" covers all Replit preview subdomains (recursive wildcard).
  // "127.0.0.1" is needed because Next.js only auto-allows "localhost", not the IP.
  allowedDevOrigins: ['**.replit.dev', '127.0.0.1'],

  // Permanent redirects
  async redirects() {
    return [
      // Old admin routes → unified Dil ve Çeviri module
      {
        source: '/admin/diller',
        destination: '/admin/dil-ve-ceviri?tab=diller',
        permanent: true,
      },
      {
        source: '/admin/ceviriler',
        destination: '/admin/dil-ve-ceviri?tab=icerik-cevirileri',
        permanent: true,
      },
      // /ana-sayfa was accidentally created as a generic PAGE record.
      // The real homepage is managed by the dedicated Ana Sayfa Düzenleyici.
      // Redirect any public hits to the real root so search engines don't
      // index the duplicate and existing bookmarks/links still work.
      {
        source: '/ana-sayfa',
        destination: '/',
        permanent: true,
      },
      // Locale-prefixed variants: /en/ana-sayfa → /en, etc.
      {
        source: '/:lang(en|de|ru|ar|es|fr|it|nl)/ana-sayfa',
        destination: '/:lang',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
