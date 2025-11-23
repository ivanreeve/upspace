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

const remotePatterns = [
  {
    protocol: 'https',
    hostname: SUPABASE_HOSTNAME,
  },
];

const nextConfig: NextConfig = {
  images: { remotePatterns },
};

export default nextConfig;
