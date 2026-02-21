import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ailms/ai', '@ailms/db', '@ailms/ingest'],

  serverExternalPackages: ['pdf-parse', 'mammoth'],

  webpack(config) {
    // Allow webpack to resolve .js imports as .ts sources (needed for ESM workspace packages)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
