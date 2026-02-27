/* eslint-disable comma-dangle, object-curly-newline */
import type { NextConfig } from 'next';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dfnwebbpjajrlfmeaarx.supabase.co';
const SUPABASE_HOSTNAME = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return 'dfnwebbpjajrlfmeaarx.supabase.co';
  }
})();

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: SUPABASE_HOSTNAME,
  },
];

const nextConfig: NextConfig = {
  experimental: {
    webpackMemoryOptimizations: true,
  },
  images: { remotePatterns },
};

export default nextConfig;
