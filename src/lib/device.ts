// Pure device detection (no server code), safe to import from client components.
// Covered by device.test.ts.

/**
 * Which installation instructions fit this device:
 * - ios: only from Safari's Share menu (no install button exists).
 * - android: the browser menu ("Instalar aplicación").
 * - chrome / edge: desktop browsers that install apps from their menu.
 * - other: desktop browsers that cannot install apps (Firefox, Safari on Mac…).
 */
export type InstallPlatform = "ios" | "android" | "chrome" | "edge" | "other";

/**
 * iPads report a desktop Mac user agent, so they need the touch hint (`maxTouchPoints`).
 * Edge's user agent also says "Chrome", so it is checked first.
 */
export function installPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Chrome\//.test(userAgent) && !/OPR\/|Firefox\//.test(userAgent)) return "chrome";
  return "other";
}
