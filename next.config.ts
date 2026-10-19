import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without it Turbopack walks up to any stray
  // package-lock.json above the repo (e.g. in $HOME) and picks that as root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Load at runtime instead of bundling: read-excel-file resolves
  // `node:worker_threads` dynamically, which Turbopack's file tracer rejects.
  serverExternalPackages: ['read-excel-file'],
  experimental: {
    serverActions: {
      bodySizeLimit: '32mb',
    },
  },
};

export default nextConfig;
