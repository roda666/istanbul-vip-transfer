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

  // ── HTTP Security Headers ──────────────────────────────────────────────────
  //
  // Applied to every route (source: '/(.*)'). Notes per header:
  //
  // Content-Security-Policy
  //   • script-src 'unsafe-inline' — required for Next.js hydration scripts,
  //     the locale/RTL inline script, and web-vitals inline initialisation.
  //     JSON-LD <script type="application/ld+json"> blocks are NOT executable
  //     and don't need this, but the Next.js runtime inline scripts do.
  //   • style-src 'unsafe-inline' — Next.js injects critical CSS inline.
  //   • font-src fonts.gstatic.com — Google Fonts font files.
  //   • img-src https: — blog hero images are arbitrary admin-entered URLs
  //     so the safest working policy is to allow all HTTPS images.
  //   • connect-src 'self' — chatbot polling, admin APIs, /api/vitals are all
  //     same-origin. OpenAI calls happen server-side (not browser) — no entry needed.
  //   • frame-ancestors 'none' — prevents clickjacking (enforced by modern browsers).
  //
  // Strict-Transport-Security
  //   Only sent in production (isDev guard). Sending HSTS over plain HTTP dev
  //   server would lock out the localhost origin in some browsers.
  //
  async headers() {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // img-src: 'self' covers /_next/image proxied GCS images;
      // blob: covers canvas/object-URL previews;
      // https: covers arbitrary admin-entered blog hero image URLs.
      "img-src 'self' data: blob: https:",
      // connect-src: all API calls are same-origin (chatbot, admin, vitals).
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      // Prevents this page from being embedded in any iframe (clickjacking guard).
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    const securityHeaders = [
      // Blocks MIME-type sniffing — protects against content-type confusion attacks.
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Prevents page from being framed (fallback for older browsers that don't
      // support frame-ancestors; modern browsers use the CSP directive above).
      { key: 'X-Frame-Options', value: 'DENY' },
      // Controls how much referrer info is sent with requests.
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Restricts access to browser features not used by this site.
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'payment=()',
          'usb=()',
          'bluetooth=()',
          'accelerometer=()',
          'gyroscope=()',
          'magnetometer=()',
          'ambient-light-sensor=()',
          'autoplay=(self)',
          'fullscreen=(self)',
        ].join(', '),
      },
      { key: 'Content-Security-Policy', value: cspDirectives },
    ];

    // HSTS: only in production — sending it over HTTP dev server can lock out localhost.
    if (!isDev) {
      securityHeaders.push({
        key:   'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

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
