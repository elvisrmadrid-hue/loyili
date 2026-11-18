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

const nextConfig: NextConfig = {
  /* config options here */
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
