import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';
// Lighthouse runs against a local HTTP production server in CI/agent audits.
// HSTS and upgrade-insecure-requests are correct for the deployed HTTPS site,
// but make Chrome intentionally show an HTTPS interstitial on that local URL.
// This flag is never set for the public deployment.
const isLighthouseAudit = process.env.LIGHTHOUSE_AUDIT === '1';
const usesRelaxedTransportHeaders = isDev || isLighthouseAudit;

const nextConfig: NextConfig = {
  // Treat nodemailer as a server-external package so Next.js doesn't attempt
  // to bundle it into any browser/fallback bundle.
  serverExternalPackages: ['nodemailer'],

  // Tree-shake lucide-react so only actually-imported icons end up in the bundle.
  // Without this Next.js would barrel-import the entire icon set (~2 MB).
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

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
    qualities:   [60, 75],
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
    const cspDirectives = usesRelaxedTransportHeaders
      ? [
          "default-src 'self'",
          // unsafe-eval: Next.js HMR + Replit bridge script need it in dev.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://challenges.cloudflare.com",
          // fonts.googleapis.com removed: migrated to next/font (self-hosted).
          "style-src 'self' 'unsafe-inline'",
          // fonts.gstatic.com removed: same reason.
          "font-src 'self' data:",
          "img-src 'self' data: blob: https:",
          // wss: needed for Next.js HMR websocket connection.
          // storage.googleapis.com: admin image uploads PUT the file directly
          // from the browser to a GCS presigned URL (see request-url route).
          "connect-src 'self' wss: https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://challenges.cloudflare.com https://storage.googleapis.com",
          "media-src 'self'",
          "object-src 'none'",
          "worker-src 'none'",
          "frame-src 'self' https://challenges.cloudflare.com",
          // Allow Replit preview iframe to embed this page.
          "frame-ancestors 'self' https://*.replit.dev https://*.repl.co https://*.replit.co",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      : [
          "default-src 'self'",
          // Google Analytics is only injected after an explicit visitor consent.
          "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://challenges.cloudflare.com",
          // fonts.googleapis.com removed: migrated to next/font (self-hosted).
          "style-src 'self' 'unsafe-inline'",
          // fonts.gstatic.com removed: same reason.
          "font-src 'self' data:",
          // img-src: 'self' covers /_next/image proxied GCS images;
          // blob: covers canvas/object-URL previews;
          // https: covers arbitrary admin-entered blog hero image URLs.
          "img-src 'self' data: blob: https:",
          // All application APIs are same-origin. The named Google endpoints are
          // used only by consent-gated Google Analytics telemetry.
          // storage.googleapis.com: admin image uploads PUT the file directly
          // from the browser to a GCS presigned URL (see request-url route).
          "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://challenges.cloudflare.com https://storage.googleapis.com",
          "media-src 'self'",
          "object-src 'none'",
          "worker-src 'none'",
          "frame-src https://challenges.cloudflare.com",
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
      ...(usesRelaxedTransportHeaders ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
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
          'accelerometer=()',
          'gyroscope=()',
          'magnetometer=()',
          'autoplay=(self)',
          'fullscreen=(self)',
        ].join(', '),
      },
      { key: 'Content-Security-Policy', value: cspDirectives },
    ];

    // HSTS: only in production — sending it over HTTP dev server can lock out localhost.
    if (!usesRelaxedTransportHeaders) {
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
  //
  // ── Single-hop guarantee ────────────────────────────────────────────────────
  // Every rule below (except the final catch-all) redirects straight to a
  // fully-qualified `https://www.istanbulviptransfer.com/...` URL, and all of
  // them are listed BEFORE the non-www→www catch-all rule. Next.js picks the
  // FIRST matching rule in array order, so a legacy request arriving on the
  // bare (non-www) domain resolves directly to its final canonical URL in one
  // 301 — it never bounces through an intermediate non-www→www hop first.
  // (Fixed 2026-08-27: previously the catch-all was first and used a relative
  // destination, which kept a bare-domain request on the bare domain, so a
  // second hop through the legacy-slug rule was always required afterwards.)
  //
  // The non-www→www catch-all stays LAST as a safety net for any URL (current
  // or future) not covered by a specific rule below.
  async redirects() {
    const WWW = 'https://www.istanbulviptransfer.com';
    return [
      // ── Internal admin / CMS redirects ────────────────────────────────────────
      // Old admin routes → unified Dil ve Çeviri module
      {
        source: '/admin/diller',
        destination: `${WWW}/admin/dil-ve-ceviri?tab=diller`,
        permanent: true,
      },
      {
        source: '/admin/ceviriler',
        destination: `${WWW}/admin/dil-ve-ceviri?tab=icerik-cevirileri`,
        permanent: true,
      },
      // /ana-sayfa was accidentally created as a generic PAGE record.
      // The real homepage is managed by the dedicated Ana Sayfa Düzenleyici.
      // Redirect any public hits to the real root so search engines don't
      // index the duplicate and existing bookmarks/links still work.
      {
        source: '/ana-sayfa',
        destination: WWW,
        permanent: true,
      },
      // Locale-prefixed variants: /en/ana-sayfa → /en, etc.
      {
        source: '/:lang(en|de|ru|ar|es|fr|it|nl)/ana-sayfa',
        destination: `${WWW}/:lang`,
        permanent: true,
      },

      // ── Domain geçişi: eski site (istanbulviptransfer.com) → yeni Next.js ──
      //
      // Eski site ASP.NET tabanlıydı; URL formatı /slug-ID-bölüm şeklindeydi.
      // Aynı ID farklı ziyaretlerde farklı slug varyantlarıyla indexlenmiş
      // olabilir (Search Console 2026-08-27 karşılaştırması: örn. id 107,
      // koddaki 'kurumsal-transfer-107-8' değil, en çok tıklanan gerçek adres
      // olan 'istanbul-bursa-ulasim-transfer-hizmetleri-107-8' olarak
      // görünüyordu). Bu yüzden her kural slug'ı YOK SAYAR ve sadece sondaki
      // `-<ID>-<bölüm>` kimliğine bakar — böylece bilinmeyen slug varyantları
      // da (yazım hataları, İngilizce başlıklar, çift tire vb.) aynı ID'ye
      // sahip oldukları için doğru hedefe düşer.
      //
      //   • Bölüm 8  = Hizmet sayfaları
      //   • Bölüm 5  = Blog yazıları
      //   • Bölüm 12 = Günübirlik tur sayfaları
      //   • Bölüm 13 = Araç/filo sayfaları (tamamı /araclar hedefine gider)
      //   • Bölüm 2  = Kurumsal/yasal/genel içerik sayfaları
      //   • Bölüm 1  = Kurumsal bilgi sayfaları (Hakkımızda ailesi)
      //
      // Aşağıdaki tüm yönlendirmeler 301 Permanent olarak işaretlenmiştir;
      // bu sayede Google arama sıralamaları yeni URL'lere aktarılır.
      //
      // ── Bölüm 8: Hizmet sayfaları (39 ID) ─────────────────────────────────────
      { source: '/:s(.*)-82-8',  destination: `${WWW}/sabiha-gokcen-havalimani-transfer`, permanent: true },
      { source: '/:s(.*)-83-8',  destination: `${WWW}/soforlu-arac-kiralama`,             permanent: true },
      { source: '/:s(.*)-84-8',  destination: `${WWW}/gelin-arabasi-kiralama`,            permanent: true },
      { source: '/:s(.*)-85-8',  destination: `${WWW}/istanbul-havalimani-transfer`,      permanent: true },
      { source: '/:s(.*)-86-8',  destination: `${WWW}/istanbul-gunubirlik-turlar`,        permanent: true },
      { source: '/:s(.*)-90-8',  destination: `${WWW}/yalova-gunubirlik-tur`,             permanent: true },
      { source: '/:s(.*)-91-8',  destination: `${WWW}/sapanca-masukiye-turu`,             permanent: true },
      { source: '/:s(.*)-92-8',  destination: `${WWW}/bursa-gunubirlik-tur`,              permanent: true },
      { source: '/:s(.*)-95-8',  destination: `${WWW}/sabiha-gokcen-havalimani-transfer`, permanent: true }, // sabiha-gokcen-airport-transfer-95-8
      { source: '/:s(.*)-96-8',  destination: `${WWW}/soforlu-arac-kiralama`,             permanent: true }, // car-rental-with-driver-96-8
      { source: '/:s(.*)-99-8',  destination: `${WWW}/yalova-gunubirlik-tur`,             permanent: true }, // yalova-daily-tours-99-8
      { source: '/:s(.*)-100-8', destination: `${WWW}/gelin-arabasi-kiralama`,            permanent: true }, // wedding-car-rental-100-8
      { source: '/:s(.*)-101-8', destination: `${WWW}/bursa-gunubirlik-tur`,              permanent: true }, // bursa-daily-tours-101-8
      { source: '/:s(.*)-102-8', destination: `${WWW}/vip-protokol-secim-araci`,          permanent: true },
      { source: '/:s(.*)-103-8', destination: `${WWW}/istanbul-havalimani-transfer`,      permanent: true },
      { source: '/:s(.*)-104-8', destination: `${WWW}/gelin-arabasi-kiralama`,            permanent: true }, // wedding-car-rental-104-8
      { source: '/:s(.*)-105-8', destination: `${WWW}/sehirler-arasi-transfer`,           permanent: true },
      { source: '/:s(.*)-106-8', destination: `${WWW}/gunluk-villa-kiralama`,             permanent: true },
      { source: '/:s(.*)-107-8', destination: `${WWW}/istanbul-bursa-transfer`,           permanent: true }, // en çok tıklanan (401) — artık slug'dan bağımsız
      { source: '/:s(.*)-108-8', destination: `${WWW}/vip-transfer`,                      permanent: true },
      { source: '/:s(.*)-109-8', destination: `${WWW}/istanbul-sapanca-transfer`,         permanent: true },
      { source: '/:s(.*)-110-8', destination: `${WWW}/vip-transfer`,                      permanent: true },
      { source: '/:s(.*)-111-8', destination: `${WWW}/antalya-vip-transfer`,              permanent: true },
      { source: '/:s(.*)-112-8', destination: `${WWW}/vip-transfer`,                      permanent: true }, // slug varyantı: vip-taksi--112-8
      { source: '/:s(.*)-113-8', destination: `${WWW}/hizmetler`,                         permanent: true },
      { source: '/:s(.*)-114-8', destination: `${WWW}/istanbul-havalimani-transfer`,      permanent: true },
      { source: '/:s(.*)-115-8', destination: `${WWW}/ankara-vip-transfer`,               permanent: true },
      { source: '/:s(.*)-116-8', destination: `${WWW}/istanbul-havalimani-transfer`,      permanent: true }, // slug varyantı: istanbul-aiport-transfer-116-8 (yazım hatalı)
      { source: '/:s(.*)-117-8', destination: `${WWW}/istanbul-bursa-transfer`,           permanent: true },
      { source: '/:s(.*)-118-8', destination: `${WWW}/soforlu-arac-kiralama`,             permanent: true },
      { source: '/:s(.*)-119-8', destination: `${WWW}/antalya-vip-transfer`,              permanent: true },
      { source: '/:s(.*)-120-8', destination: `${WWW}/vip-transfer`,                      permanent: true }, // slug varyantı: vip-taxi-istanbul-120-8
      { source: '/:s(.*)-121-8', destination: `${WWW}/vip-transfer`,                      permanent: true },
      { source: '/:s(.*)-122-8', destination: `${WWW}/izmir-vip-transfer`,                permanent: true },
      { source: '/:s(.*)-123-8', destination: `${WWW}/saglik-turizmi-transfer`,           permanent: true },
      { source: '/:s(.*)-124-8', destination: `${WWW}/saglik-turizmi-transfer`,           permanent: true }, // slug varyantı: -health-tourism-124-8
      { source: '/:s(.*)-125-8', destination: `${WWW}/antalya-vip-transfer`,              permanent: true },
      // ── Server error dönen sayfalar ───────────────────────────────────────────
      { source: '/:s(.*)-87-8',  destination: WWW,                                        permanent: true },
      { source: '/:s(.*)-93-8',  destination: WWW,                                        permanent: true },
      // ── Üyelik sayfaları (yeni sitede mevcut değil) ───────────────────────────
      { source: '/giris-yap',                                           destination: WWW,                                        permanent: true },
      { source: '/uye-kayit',                                           destination: WWW,                                        permanent: true },

      // ── Dil önekli URL varyantları (hizmet sayfaları) ─────────────────────────
      //
      // Eski sitede dil seçimi cookie tabanlıydı (URL'de prefix yoktu),
      // ancak bazı backlink'ler veya arama motorları /en/slug-ID-8 formatında
      // indexlemiş olabilir.
      {
        source: '/:lang(en|de|ru|ar|es|fr|it|nl)/:slug(.*)-:id(\\d+)-8',
        destination: `${WWW}/:lang/:slug`,
        permanent: true,
      },

      // ── Bölüm 5: Blog yazıları (24 ID) ────────────────────────────────────────
      // Mevcut makalelerle eşleşenler — 6 eski ID → 3 mevcut yeni makale
      { source: '/:s(.*)-1467-5', destination: `${WWW}/blog/istanbul-havalimani-transfer-rehberi`,               permanent: true },
      { source: '/:s(.*)-1472-5', destination: `${WWW}/blog/istanbul-havalimani-transfer-rehberi`,               permanent: true },
      { source: '/:s(.*)-1524-5', destination: `${WWW}/blog/istanbul-havalimani-transfer-rehberi`,               permanent: true },
      { source: '/:s(.*)-1471-5', destination: `${WWW}/blog/sabiha-gokcen-transfer-rehberi`,                     permanent: true },
      { source: '/:s(.*)-1473-5', destination: `${WWW}/blog/vip-transfer-ile-taksi-arasindaki-farklar`,          permanent: true },
      { source: '/:s(.*)-1470-5', destination: `${WWW}/blog/vip-transfer-ile-taksi-arasindaki-farklar`,          permanent: true },
      // Yeni makalelere yönlendirilecekler — 15 eski ID → 12 yeni makale
      { source: '/:s(.*)-1458-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true },
      { source: '/:s(.*)-1469-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true },
      { source: '/:s(.*)-1528-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true },
      { source: '/:s(.*)-1535-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true },
      { source: '/:s(.*)-1515-5', destination: `${WWW}/blog/bodrum-vip-transfer-rehberi`,                        permanent: true },
      { source: '/:s(.*)-1516-5', destination: `${WWW}/blog/yaz-tatilinde-vip-transfer-secenekleri`,             permanent: true },
      { source: '/:s(.*)-1517-5', destination: `${WWW}/blog/otel-transfer-hizmeti-nasil-calisir`,                permanent: true },
      { source: '/:s(.*)-1518-5', destination: `${WWW}/blog/havalimani-fuar-kongre-transfer`,                    permanent: true },
      { source: '/:s(.*)-1520-5', destination: `${WWW}/blog/istanbul-bogaz-sultanahmet-taksim-tur-rehberi`,      permanent: true },
      { source: '/:s(.*)-1521-5', destination: `${WWW}/blog/sehirlerarasi-vip-transfer-rehberi`,                 permanent: true },
      { source: '/:s(.*)-1522-5', destination: `${WWW}/blog/istanbul-bursa-uludag-inegol-kartepe-transfer`,      permanent: true },
      { source: '/:s(.*)-1527-5', destination: `${WWW}/blog/istanbul-vip-transfer-fiyatlari-nasil-belirlenir`,   permanent: true },
      { source: '/:s(.*)-1531-5', destination: `${WWW}/blog/vito-soforlu-arac-kiralama-rehberi`,                 permanent: true },
      { source: '/:s(.*)-1532-5', destination: `${WWW}/blog/vip-taksi-ile-standart-taksi-farklari`,              permanent: true },
      { source: '/:s(.*)-1534-5', destination: `${WWW}/blog/ankara-vip-transfer-ozel-sofor-rehberi`,             permanent: true },
      // Yeni eklenenler (2026-08-27 Search Console karşılaştırması)
      { source: '/:s(.*)-1523-5', destination: `${WWW}/guzergah/ist-havalimani-taksim`,                          permanent: true }, // 2 slug varyantı, tek ID
      { source: '/:s(.*)-1465-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true }, // uludag-kartepe-daily-tours
      { source: '/:s(.*)-1464-5', destination: `${WWW}/blog/kayak-turlarinda-vip-transfer-rehberi`,              permanent: true }, // ski-tours

      // ── Bölüm 12: Günübirlik tur sayfaları (5 ID) — 2026-08-27 eklendi ────────
      { source: '/:s(.*)-1478-12', destination: `${WWW}/yalova-gunubirlik-tur`,      permanent: true },
      { source: '/:s(.*)-1476-12', destination: `${WWW}/istanbul-gunubirlik-turlar`, permanent: true },
      { source: '/:s(.*)-1477-12', destination: `${WWW}/bursa-gunubirlik-tur`,       permanent: true },
      { source: '/:s(.*)-1474-12', destination: `${WWW}/sapanca-masukiye-turu`,      permanent: true },
      { source: '/:s(.*)-1457-12', destination: `${WWW}/istanbul-gunubirlik-turlar`, permanent: true }, // bolu-abant-yedigoller — en yakın gün turu sayfasına

      // ── Bölüm 13: Araç/filo sayfaları — tüm ID'ler /araclar hedefine ──────────
      // 2026-08-27 eklendi. Tek tek ID eşlemek yerine genel kalıp kullanılıyor:
      // bu bölümdeki HER sayfa (mercedes-sprinter, mercedes-vito, full-lux-vip-vito, ...)
      // zaten tek bir /araclar sayfasına gidiyor, ID'nin kendisi önemsiz.
      { source: '/:s(.*)-:id(\\d+)-13', destination: `${WWW}/araclar`, permanent: true },

      // ── Bölüm 2: Kurumsal/yasal/genel içerik sayfaları (8 ID) — 2026-08-27 ────
      { source: '/:s(.*)-1071-2', destination: `${WWW}/hizmetler`,                                     permanent: true }, // sik-sorulan-sorular — genel SSS sayfası yok
      { source: '/:s(.*)-1087-2', destination: `${WWW}/blog/vip-taksi-ile-standart-taksi-farklari`,    permanent: true },
      { source: '/:s(.*)-1068-2', destination: `${WWW}/yasal/kullanim-kosullari`,                      permanent: true },
      { source: '/:s(.*)-1069-2', destination: `${WWW}/yasal/gizlilik-politikasi`,                     permanent: true },
      // iptal-ve-iade: yeni sitede birebir karşılığı yok. İptal/iade koşulları
      // genelde Kullanım Koşulları kapsamında ele alınır, bu yüzden en yakın
      // konu-alaka sayfası olan Kullanım Koşulları'na yönlendiriliyor
      // (/iletisim yerine — orası soruyu yanıtlamaz, sadece iletişim sağlar).
      { source: '/:s(.*)-1070-2', destination: `${WWW}/yasal/kullanim-kosullari`,                      permanent: true },
      { source: '/:s(.*)-1084-2', destination: `${WWW}/en/yalova-day-tour`,                            permanent: true }, // yalova-daily-tours (İngilizce sayfa)
      { source: '/:s(.*)-1082-2', destination: `${WWW}/en/bursa-day-tour`,                             permanent: true }, // bursa-daily-tours (İngilizce sayfa)
      { source: '/:s(.*)-1083-2', destination: `${WWW}/en/sapanca-masukiye-tour`,                      permanent: true }, // sapanca-masukiye-daily-tours (İngilizce sayfa)

      // ── Bölüm 1: Kurumsal bilgi sayfaları (2 ID) — 2026-08-27 eklendi ─────────
      { source: '/:s(.*)-24-1',   destination: `${WWW}/hakkimizda`,   permanent: true },
      { source: '/:s(.*)-1030-1', destination: `${WWW}/en/about-us`,  permanent: true },

      // ── ID'siz eski adresler — 2026-08-27 eklendi ─────────────────────────────
      { source: '/populer-transfer-listesi',   destination: `${WWW}/hizmetler`, permanent: true },
      { source: '/tur-listesi-tumu-0',         destination: `${WWW}/hizmetler`, permanent: true },
      { source: '/anasayfa2.aspx',             destination: WWW,                permanent: true },
      { source: '/Anasayfa2',                  destination: WWW,                permanent: true },
      { source: '/Default.aspx/Anasayfa',      destination: WWW,                permanent: true },

      // ── Canonical domain: non-www → www ───────────────────────────────────────
      // Catch-all safety net for any URL (current or future) not covered by a
      // specific rule above. Must stay LAST — Next.js uses the first matching
      // rule, and every rule above already targets a fully-qualified www URL.
      {
        source:      '/:path*',
        has:         [{ type: 'host', value: 'istanbulviptransfer.com' }],
        destination: 'https://www.istanbulviptransfer.com/:path*',
        permanent:   true,
      },
    ];
  },
};

export default nextConfig;
