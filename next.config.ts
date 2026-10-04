import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      canvas: false,
    };
    return config;
  },
  // Prevents Next.js from trying to bundle the worker
  transpilePackages: ['pdfjs-dist'],
};

export default nextConfig;