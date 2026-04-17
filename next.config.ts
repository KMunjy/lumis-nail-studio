import type { NextConfig } from "next";

// ── DevSecOps: HTTP Security Headers ─────────────────────────────────────────
// Applied to every response via Next.js headers() config.
// CSP is intentionally permissive for MediaPipe WASM requirements:
//   • 'unsafe-eval'  — WebAssembly requires eval-equivalent in older browsers
//   • 'wasm-unsafe-eval' — newer browsers use this narrower directive instead
//   • blob:           — MediaPipe spawns Web Workers from blob URLs
//   • cdn.jsdelivr.net / storage.googleapis.com — WASM + model CDN origins
const securityHeaders = [
  // Prevent page from being embedded in iframes (clickjacking defence)
  { key: "X-Frame-Options",           value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Referrer only sent to same origin
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  // Permissions: allow camera (AR core), block everything else
  { key: "Permissions-Policy",        value: "camera=*, microphone=(), geolocation=(), payment=()" },
  // HSTS: force HTTPS for 1 year in production
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline chunks + MediaPipe CDN + WASM eval
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
      // Workers: blob: for MediaPipe Web Worker bootstrap
      "worker-src 'self' blob:",
      // Network: Supabase, Sentry telemetry, Upstash Redis (rate-limiter), MediaPipe CDN
      // *.supabase.co covers Auth, REST, Realtime and Storage endpoints.
      // *.ingest.sentry.io — Sentry error + performance telemetry (P0-1)
      // *.upstash.io — Upstash Redis REST API for shared rate-limiting (P1-3)
      "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://*.ingest.sentry.io https://*.upstash.io",
      // Images: data URIs (canvas toDataURL) + external product images
      "img-src 'self' data: blob: https://images.unsplash.com https://storage.googleapis.com",
      // Styles: Next.js injects inline styles
      "style-src 'self' 'unsafe-inline'",
      // Fonts: Google Fonts CDN (DM Sans, JetBrains Mono, Cormorant)
      "font-src 'self' https://fonts.gstatic.com",
      // Media: getUserMedia output streams
      "media-src 'self' blob:",
      // No plugins
      "object-src 'none'",
      // No framing by anyone
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Security headers on all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Allow phone/tablet on the same network to connect during development
  allowedDevOrigins: [
    "192.168.1.73",
    "keren-untranslatable-buzzingly.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],

  // Standalone output: self-contained Node.js server bundle (used by Dockerfile)
  output: "standalone",

  // Turbopack root — silences multi-lockfile warning when running `next dev --turbopack`
  turbopack: {
    root: __dirname,
  },

  // Exclude WASM-backed packages from SSR bundling.
  // onnxruntime-web ships its own WASM workers and must only run in the browser;
  // bundling it server-side (or via Turbopack SSR pass) causes "module not found" errors.
  serverExternalPackages: ["onnxruntime-web"],

  // Allow Unsplash + GCS images for product catalog
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
