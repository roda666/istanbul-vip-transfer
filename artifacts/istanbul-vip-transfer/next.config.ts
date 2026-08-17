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
  //
  //   • script-src 'unsafe-inline' — still required for Next.js App Router.
  //     The RSC streaming renderer injects inline <script> tags (e.g.
  //     self.__next_f.push([...])) that cannot carry a nonce without migrating
  //     CSP generation from next.config.ts headers() into middleware (per-request
  //     nonce) and patching every <Script> component. That migration is tracked
  //     as a follow-up task. Until then 'unsafe-inline' stays but is the ONLY
  //     relaxation — no 'unsafe-eval' in production, no wildcard domains.
  //   • style-src 'unsafe-inline' — Next.js injects critical CSS inline;
  //     fonts.googleapis.com removed (migrated to next/font — self-hosted).
  //   • font-src — fonts.gstatic.com removed (same reason); only 'self' + data:.
  //   • img-src https: — blog hero images are arbitrary admin-entered URLs
  //     so the safest working policy is to allow all HTTPS images.
  //   • connect-src 'self' — chatbot polling, admin APIs, vitals — all same-origin.
  //     OpenAI calls happen server-side (not in browser) — no entry needed.
  //   • upgrade-insecure-requests — forces any http:// sub-resource to https://.
  //   • worker-src 'none' — no service workers registered on this site.
  //   • frame-ancestors 'none' — prevents clickjacking (enforced by modern browsers).
  //
  // Strict-Transport-Security
  //   Only sent in production (isDev guard). Sending HSTS over plain HTTP dev
  //   server would lock out the localhost origin in some browsers.
  //
  async headers() {
    // ── In dev (Replit preview), use a relaxed CSP so the preview iframe works.
    // In production, apply a strict policy.
    //
    // Why the relaxation is needed in dev:
    //   • Replit embeds the app in an iframe on *.replit.dev / *.repl.co —
    //     frame-ancestors 'none' and X-Frame-Options: DENY block this entirely.
    //   • Replit's bridge script (replit-bridge.js) uses eval() — 'unsafe-eval'
    //     is required so it doesn't throw an unhandled CSP error on load.
    //   • Next.js HMR uses WebSocket — wss: must be in connect-src in dev.
    const cspDirectives = isDev
      ? [
          "default-src 'self'",
          // unsafe-eval: Next.js HMR + Replit bridge script need it in dev.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          // fonts.googleapis.com removed: migrated to next/font (self-hosted).
          "style-src 'self' 'unsafe-inline'",
          // fonts.gstatic.com removed: same reason.
          "font-src 'self' data:",
          "img-src 'self' data: blob: https:",
          // wss: needed for Next.js HMR websocket connection.
          "connect-src 'self' wss:",
          "media-src 'self'",
          "object-src 'none'",
          "worker-src 'none'",
          "frame-src 'self'",
          // Allow Replit preview iframe to embed this page.
          "frame-ancestors 'self' https://*.replit.dev https://*.repl.co https://*.replit.co",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          // fonts.googleapis.com removed: migrated to next/font (self-hosted).
          "style-src 'self' 'unsafe-inline'",
          // fonts.gstatic.com removed: same reason.
          "font-src 'self' data:",
          // img-src: 'self' covers /_next/image proxied GCS images;
          // blob: covers canvas/object-URL previews;
          // https: covers arbitrary admin-entered blog hero image URLs.
          "img-src 'self' data: blob: https:",
          // connect-src: all API calls are same-origin (chatbot, admin, vitals).
          "connect-src 'self'",
          "media-src 'self'",
          "object-src 'none'",
          "worker-src 'none'",
          "frame-src 'none'",
          // Forces any accidental http:// sub-resource load to https://.
          "upgrade-insecure-requests",
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
      // In dev we omit this so the Replit preview iframe can load the page.
      ...(isDev ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
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
      // ── Internal admin / CMS redirects ────────────────────────────────────────
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

      // ── Domain geçişi: eski site (istanbulviptransfer.com) → yeni Next.js ──
      //
      // Eski site ASP.NET tabanlıydı; URL formatı /slug-ID-tip şeklindeydi:
      //   • Hizmet sayfaları: /slug-<id>-8
      //   • Blog yazıları:    /slug-<id>-5  (ayrı aşamada ele alınacak)
      //
      // Aşağıdaki tüm yönlendirmeler 301 Permanent olarak işaretlenmiştir;
      // bu sayede Google arama sıralamaları yeni URL'lere aktarılır.
      //
      // ── TR Hizmet sayfaları (ana sayfada listeleniyordu) ──────────────────────
      { source: '/sabiha-gokcen-havalimani-transfer-82-8',              destination: '/sabiha-gokcen-havalimani-transfer', permanent: true },
      { source: '/soforlu-arac-kiralama-83-8',                          destination: '/soforlu-arac-kiralama',             permanent: true },
      { source: '/gelin-arabasi-kiralama-84-8',                         destination: '/gelin-arabasi-kiralama',            permanent: true },
      { source: '/istanbul-havalimani-transfer-85-8',                   destination: '/istanbul-havalimani-transfer',      permanent: true },
      { source: '/istanbul-gunubirlik-turlar-86-8',                     destination: '/istanbul-gunubirlik-turlar',        permanent: true },
      { source: '/yalova-gunubirlik-turlar-90-8',                       destination: '/yalova-gunubirlik-tur',             permanent: true },
      { source: '/sapanca-ve-masukiye-gunubirlik-turlari-91-8',         destination: '/sapanca-masukiye-turu',             permanent: true },
      { source: '/bursa-gunubirlik-turlar-92-8',                        destination: '/bursa-gunubirlik-tur',              permanent: true },
      { source: '/vip-protokol-ve-secim-araci-102-8',                   destination: '/vip-protokol-secim-araci',          permanent: true },
      { source: '/istanbul-airport-transfer-103-8',                     destination: '/istanbul-havalimani-transfer',      permanent: true },
      { source: '/sehirlerarasi-transfer-105-8',                        destination: '/sehirler-arasi-transfer',           permanent: true },
      { source: '/gunluk-villa-kiralama-villa-azelya-106-8',            destination: '/gunluk-villa-kiralama',             permanent: true },
      { source: '/kurumsal-transfer-107-8',                             destination: '/istanbul-bursa-transfer',           permanent: true },
      { source: '/istanbuldan-sakarya-ve--sapanca-arasi-transfer-109-8',destination: '/istanbul-sapanca-transfer',         permanent: true },
      { source: '/vip-transfer-110-8',                                  destination: '/vip-transfer',                     permanent: true },
      { source: '/ankara-vip-transfer-115-8',                           destination: '/ankara-vip-transfer',              permanent: true },
      { source: '/antalya-vip-transfer-119-8',                          destination: '/antalya-vip-transfer',             permanent: true },
      { source: '/istanbul-vip-transfer-121-8',                         destination: '/vip-transfer',                     permanent: true },
      { source: '/izmir-vip-transfer-122-8',                            destination: '/izmir-vip-transfer',               permanent: true },
      { source: '/saglik-turizmi-123-8',                                destination: '/saglik-turizmi-transfer',          permanent: true },
      // ── Ek erişilebilir sayfalar (EN varyantları / terk edilmişler) ───────────
      { source: '/havalimani-transfer-111-8',                           destination: '/antalya-vip-transfer',             permanent: true },
      { source: '/istanbul-tur-112-8',                                  destination: '/vip-transfer',                     permanent: true },
      { source: '/kartepe-kayak-turu-113-8',                            destination: '/hizmetler',                        permanent: true },
      { source: '/uludag-kayak-turu-114-8',                             destination: '/istanbul-havalimani-transfer',     permanent: true },
      { source: '/istanbul-tour-116-8',                                 destination: '/istanbul-havalimani-transfer',     permanent: true },
      { source: '/vip-transfer-117-8',                                  destination: '/istanbul-bursa-transfer',          permanent: true },
      { source: '/kiralik-mercedes-118-8',                              destination: '/soforlu-arac-kiralama',            permanent: true },
      { source: '/bursa-vip-transfer-120-8',                            destination: '/vip-transfer',                     permanent: true },
      { source: '/trabzon-vip-transfer-124-8',                          destination: '/saglik-turizmi-transfer',          permanent: true },
      // ── Server error dönen sayfalar ───────────────────────────────────────────
      { source: '/kurumsal-87-8',                                       destination: '/',                                 permanent: true },
      { source: '/uludag-kayak-turu-93-8',                              destination: '/',                                 permanent: true },
      { source: '/vip-transfer-hizmetleri-108-8',                       destination: '/vip-transfer',                     permanent: true },
      { source: '/bodrum-vip-transfer-125-8',                           destination: '/antalya-vip-transfer',             permanent: true },
      // ── Üyelik sayfaları (yeni sitede mevcut değil) ───────────────────────────
      { source: '/giris-yap',                                           destination: '/',                                 permanent: true },
      { source: '/uye-kayit',                                           destination: '/',                                 permanent: true },

      // ── Dil önekli URL varyantları (hizmet sayfaları) ─────────────────────────
      //
      // Eski sitede dil seçimi cookie tabanlıydı (URL'de prefix yoktu),
      // ancak bazı backlink'ler veya arama motorları /en/slug-ID-8 formatında
      // indexlemiş olabilir.
      {
        source: '/:lang(en|de|ru|ar|es|fr|it|nl)/:slug(.*)-:id(\\d+)-8',
        destination: '/:lang/:slug',
        permanent: true,
      },

      // ── Blog yazıları: mevcut makalelerle eşleşenler ─────────────────────────
      // 6 eski URL → 3 mevcut yeni makale
      { source: '/istanbul-yeni-havalimanina-ulasim-1467-5',                          destination: '/blog/istanbul-havalimani-transfer-rehberi',               permanent: true },
      { source: '/istanbul-havalimanina-ulasim-1472-5',                               destination: '/blog/istanbul-havalimani-transfer-rehberi',               permanent: true },
      { source: '/istanbul-havalimanina-nasil-gidilir-1524-5',                        destination: '/blog/istanbul-havalimani-transfer-rehberi',               permanent: true },
      { source: '/sabiha-gokcen-havalimanina-ulasim-1471-5',                          destination: '/blog/sabiha-gokcen-transfer-rehberi',                     permanent: true },
      { source: '/vip-transfer-1473-5',                                               destination: '/blog/vip-transfer-ile-taksi-arasindaki-farklar',          permanent: true },
      { source: '/kapidan-kapiya-transfer-sehir-ici-transfer-1470-5',                 destination: '/blog/vip-transfer-ile-taksi-arasindaki-farklar',          permanent: true },

      // ── Blog yazıları: yeni makalelere yönlendirilecekler ─────────────────────
      // 15 eski URL → 12 yeni makale
      { source: '/kayak-turlari-1458-5',                                              destination: '/blog/kayak-turlarinda-vip-transfer-rehberi',              permanent: true },
      { source: '/populer-kayak-merkezlerine-transfer-hizmeti-1469-5',                destination: '/blog/kayak-turlarinda-vip-transfer-rehberi',              permanent: true },
      { source: '/uludag-kayak-turu-1528-5',                                          destination: '/blog/kayak-turlarinda-vip-transfer-rehberi',              permanent: true },
      { source: '/istanbuldan-kis-tatili-kis-turizmi-icin-en-iyi-secenekler-1535-5',  destination: '/blog/kayak-turlarinda-vip-transfer-rehberi',              permanent: true },
      { source: '/bodrum-vip-transfer-1515-5',                                        destination: '/blog/bodrum-vip-transfer-rehberi',                        permanent: true },
      { source: '/yaz-tatilinde-seyahat-secenekleri-istanbul-vip-transfer-1516-5',    destination: '/blog/yaz-tatilinde-vip-transfer-secenekleri',             permanent: true },
      { source: '/hotel-transfer-1517-5',                                             destination: '/blog/otel-transfer-hizmeti-nasil-calisir',                permanent: true },
      { source: '/havaalanindan-fuarlara-transfer-hizmeti--1518-5',                   destination: '/blog/havalimani-fuar-kongre-transfer',                    permanent: true },
      { source: '/istanbul-bogaz-camlica-sultanahmet-taksim-beyoglu-turlari-1520-5',  destination: '/blog/istanbul-bogaz-sultanahmet-taksim-tur-rehberi',      permanent: true },
      { source: '/istanbul-vip-transfer-ile-sehirler-arasi-transfer-1521-5',          destination: '/blog/sehirlerarasi-vip-transfer-rehberi',                 permanent: true },
      { source: '/istanbul-cikisli--bursa--uludag-inegol-ve--kartepe-transfer-hizmetleri-1522-5', destination: '/blog/istanbul-bursa-uludag-inegol-kartepe-transfer', permanent: true },
      { source: '/istanbul-vip-transfer-fiyatlari-1527-5',                            destination: '/blog/istanbul-vip-transfer-fiyatlari-nasil-belirlenir',   permanent: true },
      { source: '/vito-kiralama-1531-5',                                              destination: '/blog/vito-soforlu-arac-kiralama-rehberi',                 permanent: true },
      { source: '/vip-taksi-1532-5',                                                  destination: '/blog/vip-taksi-ile-standart-taksi-farklari',              permanent: true },
      { source: '/ankarada-vip-taksi-hizmeti-1534-5',                                 destination: '/blog/ankara-vip-transfer-ozel-sofor-rehberi',             permanent: true },
    ];
  },
};

export default nextConfig;
