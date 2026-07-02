import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  // Transpile the shared workspace package (ships raw TS from packages/core).
  transpilePackages: ["@whistl/core"],
};

export default nextConfig;
