/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Required for Playwright in API routes (Next.js 14 key)
    serverComponentsExternalPackages: ["playwright", "playwright-core"],
  },
};

export default nextConfig;
