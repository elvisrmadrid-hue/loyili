/** Where users land after signing in when there is no `next` parameter. */
export const DEFAULT_AFTER_SIGN_IN = "/wallet";

/** Routes that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/panel", "/wallet"] as const;

/** Routes only for signed-out visitors (signed-in users are sent to DEFAULT_AFTER_SIGN_IN). */
export const GUEST_ONLY_PATHS = ["/login", "/registro"] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isGuestOnlyPath(pathname: string) {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
}

/**
 * Returns `next` only if it is an internal path of this app; otherwise the fallback.
 * Prevents "open redirects" such as /login?next=https://evil.example
 * (also blocks protocol-relative "//evil.example" and "/\evil.example").
 */
export function safeNextPath(next: unknown, fallback: string = DEFAULT_AFTER_SIGN_IN): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
