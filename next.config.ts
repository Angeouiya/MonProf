import type { NextConfig } from "next";
import path from "node:path";

const distDir = process.env.NEXT_DIST_DIR?.trim() || undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  ...(distDir ? { distDir } : {}),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  reactStrictMode: false,
  // Vercel continue d'utiliser Turbopack. La configuration explicite permet
  // de garder en parallèle l'alias Webpack utilisé uniquement par OpenNext.
  turbopack: {},
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Next 16.3 resolves this template import from the project root on
      // Windows instead of from next/dist/build/templates. Pinning the real
      // server-only module keeps the Cloudflare Webpack build deterministic.
      "../../server/lib/router-utils/instrumentation-globals.external": path.resolve(
        process.cwd(),
        "node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js",
      ),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
