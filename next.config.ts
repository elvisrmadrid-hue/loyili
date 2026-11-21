import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Private IPv4 addresses of this computer (e.g. 192.168.0.10). In development, a phone on
 * the same Wi-Fi can open the app at http://<address>:3000 — handy to show the wallet QR to
 * the computer's webcam. Only affects `next dev`.
 */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address)
    .filter((address) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
}

/**
 * Security headers for every response (recommended by the Next.js PWA guide). HTTPS itself
 * (and HSTS) is handled by the hosting (Vercel).
 */
const securityHeaders = [
  // Browsers must not guess file types (a file is what the server says it is).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No other website may show Loyili inside a frame (protects against "clickjacking").
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Other sites only learn that a visitor came from Loyili, never the exact page.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The camera only for Loyili itself (QR scanning at the register); no microphone or location.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: lanAddresses(),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
