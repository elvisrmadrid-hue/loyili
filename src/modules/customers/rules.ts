// Pure join-code logic (no server code), safe to import from client components.
// Covered by rules.test.ts.

/** 6 symbols without look-alikes (no 0, O, 1, I). Must match the database check. */
const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * Cleans a join code typed or read from a URL: uppercase, without spaces or dashes.
 * Returns null if it cannot be a valid code.
 */
export function normalizeJoinCode(text: string): string | null {
  const code = text.replace(/[\s-]/g, "").toUpperCase();
  return JOIN_CODE_PATTERN.test(code) ? code : null;
}

/** Public page where customers join a merchant's program. */
export function joinPath(code: string): string {
  return `/unirse/${code}`;
}
