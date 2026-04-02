/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Security headers applied to every response ─────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self'",
              "connect-src 'self' https://api.stripe.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ── Image optimization ─────────────────────────────────────
  images: {
    formats: ["image/webp", "image/avif"],     // modern compressed formats
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.yourstore.com",          // restrict to your CDN only
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",        // dev placeholder
      },
    ],
    minimumCacheTTL: 3600,
  },

  // ── Never expose server vars to the client bundle ──────────
  // Use NEXT_PUBLIC_ prefix ONLY for truly public values
  env: {},

  // ── Output ────────────────────────────────────────────────
  output: "standalone",                        // Docker-friendly
  reactStrictMode: true,
  poweredByHeader: false,                      // don't advertise Next.js version
};

module.exports = nextConfig;
