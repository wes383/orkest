import type { NextConfig } from "next";

const CUSTOM_DOMAIN = "orkest.wesluma.com";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/OneSignalSDKWorker.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/orkest-sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "orkest-one.vercel.app",
          },
        ],
        destination: `https://${CUSTOM_DOMAIN}/:path*`,
        permanent: true,
      },
    ];
  },
  turbopack: {},
};

export default nextConfig;
