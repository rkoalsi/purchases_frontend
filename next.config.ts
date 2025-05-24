import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  env: {
    api_url: 'https://purchase.pupscribe.in/api',
  },
};

export default nextConfig;
