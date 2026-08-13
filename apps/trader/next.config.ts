import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Allow the Codex in-app browser to load development assets from the local LAN host.
  // This setting only controls Next.js development resources.
  allowedDevOrigins: ["10.218.35.185"],
  // Dependencies are hoisted to the workspace root. Declare that root explicitly so
  // Turbopack resolves the same dependency graph in development and production.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  // Privy can cancel an in-flight app-config request during Fast Refresh. It reports
  // that expected cancellation as a browser warning, so only forward genuine browser
  // errors to the development terminal.
  logging: {
    browserToTerminal: "error",
  },
};

export default nextConfig;
