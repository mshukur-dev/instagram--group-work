import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Same-origin /api/* so auth cookies work (see docs/spec/architecture.md)
  async rewrites() {
    // Trimmed and without a trailing slash: values pasted into the hosting settings vary
    const api = (process.env.API_URL?.trim() || 'http://localhost:4000').replace(/\/+$/, '');
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
