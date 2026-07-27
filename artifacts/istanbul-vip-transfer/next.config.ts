import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
