// Pure customer-code logic (no server code), safe to import from client components.
// Covered by rules.test.ts.

/** 8 symbols without look-alikes (no 0, O, 1, I). Must match issue_customer_code(). */
const CUSTOMER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/** The wallet asks for a new code this many seconds before the current one expires. */
export const RENEW_BEFORE_SECONDS = 30;

/**
 * Cleans a customer code typed at the register or read from the QR: uppercase, without
 * spaces or dashes. Returns null if it cannot be a valid code.
 */
export function normalizeCustomerCode(text: string): string | null {
  const code = text.replace(/[\s-]/g, "").toUpperCase();
  return CUSTOMER_CODE_PATTERN.test(code) ? code : null;
}

/** "K7P2QX4M" → "K7P2-QX4M" (easier to read aloud and to type). */
export function formatCustomerCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Seconds → "4:05". */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
