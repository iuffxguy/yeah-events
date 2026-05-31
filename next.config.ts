import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Required for Playwright in API routes
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
