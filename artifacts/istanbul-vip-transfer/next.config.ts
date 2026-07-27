import type { NextConfig } from 'next';

const devOrigins = process.env.REPLIT_DEV_DOMAIN
  ? [`https://${process.env.REPLIT_DEV_DOMAIN}`, `http://${process.env.REPLIT_DEV_DOMAIN}`]
  : [];

const nextConfig: NextConfig = {
  // Static-export ready: unoptimized images work with `output: 'export'`
  // when deploying to a plain file server. To enable, add:
  //   output: 'export',
  // and update the artifact.toml publicDir to "out".
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', ...devOrigins],
};

export default nextConfig;
