import type { NextConfig } from "next";

// Backend API origin, used in the CSP connect-src below since it's not
// available as an env var at this config-evaluation stage on Render.
const BACKEND_ORIGIN = "https://aureon-backend-g5c9.onrender.com";

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' on scripts is scoped to Paddle's own loader needing it;
  // Next.js's hydration scripts also rely on it without a nonce setup.
  `script-src 'self' 'unsafe-inline' https://cdn.paddle.com`,
  // Inline style={{}} props are used throughout the app — CSP's style-src
  // (and the style-src-attr it falls back to) needs 'unsafe-inline' or
  // every inline-styled element silently loses its styling.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${BACKEND_ORIGIN} https://*.supabase.co https://*.paddle.com`,
  "frame-src https://*.paddle.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
