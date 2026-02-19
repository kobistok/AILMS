import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow importing from workspace packages
  transpilePackages: ['@ailms/ai', '@ailms/db', '@ailms/ingest'],

  experimental: {
    // Required for Supabase server components
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
};

export default nextConfig;
