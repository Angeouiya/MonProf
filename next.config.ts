import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  reactStrictMode: false,
};

export default nextConfig;
