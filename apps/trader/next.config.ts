import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared workspace package (it ships raw TS from packages/core).
  transpilePackages: ["@whistl/core"],
};

export default nextConfig;
