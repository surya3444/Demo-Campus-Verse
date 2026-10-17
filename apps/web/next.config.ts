import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@campus-verse/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
  // Pages folded into others; kept as redirects so old links still land.
  async redirects() {
    return [
      { source: '/students/promote', destination: '/exams/promotion', permanent: false },
      { source: '/organization/programs', destination: '/organization/explorer', permanent: false },
      {
        source: '/career-connect/virtual-placement-officer',
        destination: '/career-connect/virtual-placement-office',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // API_PROXY_TARGET lets the browser use a same-origin /api (e.g. behind one tunnel).
        destination: `${process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
