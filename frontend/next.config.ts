import type { NextConfig } from "next";

// Backend API origin, used in the CSP connect-src below since it's not
// available as an env var at this config-evaluation stage on Render.
const BACKEND_ORIGIN = "https://aureon-backend-g5c9.onrender.com";

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' on scripts is scoped to Paddle's own loader needing it;
  // Next.js's hydration scripts also rely on it without a nonce setup.
  // 'unsafe-eval' is added only in dev — React's dev-mode debugging tools
  // (fast refresh, stack-trace reconstruction) use eval(); the production
  // build never does, so prod stays locked down.
  `script-src 'self' 'unsafe-inline' https://cdn.paddle.com https://www.googletagmanager.com${
    process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""
  }`,
  // Inline style={{}} props are used throughout the app — CSP's style-src
  // (and the style-src-attr it falls back to) needs 'unsafe-inline' or
  // every inline-styled element silently loses its styling.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // GA4 hits go to region-specific *.google-analytics.com / *.analytics.google.com
  // endpoints, and the gtag.js loader itself calls back to googletagmanager.com.
  `connect-src 'self' ${BACKEND_ORIGIN} https://*.supabase.co https://*.paddle.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
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
          // microphone=(self) -- was () (hard blocked, no exceptions) from
          // before the voice call feature existed. This header overrides
          // any browser/OS mic permission the user grants; with it at (),
          // getUserMedia/SpeechRecognition were *always* going to fail
          // with NotAllowedError on this origin no matter what the user
          // did in their browser or OS settings -- confirmed live across
          // Brave and Chrome, both correctly configured, both still
          // denied, because the actual block was here, not in either
          // browser. (self) allows the site's own pages to request it
          // while still blocking any third-party iframe from doing so.
          // camera/geolocation stay blocked -- genuinely unused.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
