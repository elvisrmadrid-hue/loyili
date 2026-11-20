// Pure device detection (no server code), safe to import from client components.
// Covered by device.test.ts.

/** Which installation instructions fit this device. */
export type InstallPlatform = "ios" | "android" | "other";

/**
 * Tells iPhone/iPad (installed only from Safari's Share menu) from Android and the rest
 * (where the browser itself offers to install). iPads report a desktop Mac user agent, so
 * they need the touch hint.
 */
export function installPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}
