import type { MetadataRoute } from "next";

/**
 * Web app manifest: what the phone needs to install Loyili as an app (name, icon, colors,
 * and that it opens without the browser bar). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loyili",
    short_name: "Loyili",
    description: "Tus puntos y recompensas de cada comercio, sin tarjetas físicas.",
    lang: "es",
    id: "/",
    // /inicio sends people who work at a merchant to their panel and everyone else to the wallet.
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
