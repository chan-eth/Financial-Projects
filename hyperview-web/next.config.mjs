/** @type {import('next').NextConfig} */

// HYPERVIEW_API is read server-side only (used by /app/api/market/* route handlers).
// Browser code never knows the API base directly; it always hits same-origin /api/*.
// In production: set HYPERVIEW_API to https://api.hyperview.xyz.
// In dev: leave unset to fall back to Hyperliquid testnet directly (see lib/marketServer.ts).
const apiBase = process.env.HYPERVIEW_API ?? "https://api.hyperliquid-testnet.xyz";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // connect-src deliberately omits the upstream API host — the browser only
  // talks to same-origin /api/market/* which our server proxies upstream.
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
