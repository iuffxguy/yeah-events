/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Required for Playwright in API routes
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
