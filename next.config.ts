import path from "node:path";
import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/lib/http/security-headers";

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
  // CSP + hardening headers on every route. NEXT_PUBLIC_SUPABASE_URL is read at
  // build time, the same moment Next inlines it into the browser bundle.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === 'development',
        }),
      },
    ];
  },
};

export default nextConfig;
