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

  // Static-export ready: unoptimized images work with `output: 'export'`
  // when deploying to a plain file server. To enable, add:
  //   output: 'export',
  // and update the artifact.toml publicDir to "out".
  images: {
    unoptimized: true,
  },
  // allowedDevOrigins expects bare hostnames (no scheme).
  // Next.js parses the incoming Origin header, extracts .hostname,
  // and matches that against this list — so "https://host" never matches.
  // "**.replit.dev" covers all Replit preview subdomains (recursive wildcard).
  // "127.0.0.1" is needed because Next.js only auto-allows "localhost", not the IP.
  allowedDevOrigins: ['**.replit.dev', '127.0.0.1'],

  // Permanent redirects: old admin routes → unified Dil ve Çeviri module
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
