import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Neon serverless driver and its WebSocket transport out of the
  // server bundle. `ws` has optional native bindings and dynamic requires that
  // break when webpack/Turbopack inlines them, which made every DB-backed API
  // route throw at runtime (500s). Loading them as real node_modules at runtime
  // avoids that.
  serverExternalPackages: [
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],
  async headers() {
    return [
      {
        // Allow service worker to control /courier/ scope
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript" },
        ],
      },
      {
        // Manifest CORS
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Icons cache
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
