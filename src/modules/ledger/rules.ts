// Pure ledger helpers (no server code), safe to import from client components.
// Covered by rules.test.ts.
import { currencyDecimals, currencyLocale } from "@/lib/currencies";

/** Safety cap per purchase (a typo with an extra zero), in currency units. Not a business rule. */
export const MAX_PURCHASE_UNITS = 100_000_000;

export const REVERSAL_REASON_MIN = 3;
export const REVERSAL_REASON_MAX = 200;

const SPACES = /[\s  ]/g;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Thousands and decimal separators the currency's country uses ("." and "," in Colombia). */
function separatorsOf(currency: string) {
  const parts = new Intl.NumberFormat(currencyLocale(currency)).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  return { group: group.replace(SPACES, " "), decimal };
}

/**
 * Reads an amount written the way people write it in the currency's country and returns
 * it in minor units (cents): "25.500" COP -> 2550000, "12.50" USD -> 1250, "1,234.56" USD
 * -> 123456. Thousands may also be separated with spaces. Cents are accepted only in
 * currencies that have them.
 *
 * Returns null for empty, invalid or ambiguous input (for example "25.5" in COP, where "."
 * separates thousands), so a mistyped amount is never silently read as something else.
 */
export function parseMoneyAmount(text: string, currency: string): number | null {
  const value = text.trim().replace(SPACES, " ");
  if (value === "") return null;

  const decimals = currencyDecimals(currency);
  const { group, decimal } = separatorsOf(currency);
  const groupChars = [...new Set([group, " "])].map(escapeRegExp).join("|");
  const integerPart = `(\\d+|\\d{1,3}((${groupChars})\\d{3})+)`;
  const decimalPart = decimals > 0 ? `(${escapeRegExp(decimal)}(\\d{1,${decimals}}))?` : "";
  const match = new RegExp(`^${integerPart}${decimalPart}$`).exec(value);
  if (!match) return null;

  const units = Number(match[1].replace(new RegExp(groupChars, "g"), ""));
  const fraction = decimals > 0 && match[5] ? match[5].padEnd(decimals, "0") : "0";
  const minor = units * 10 ** decimals + Number(fraction);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Largest purchase accepted, in minor units of the currency. */
export function maxPurchaseMinor(currency: string): number {
  return MAX_PURCHASE_UNITS * 10 ** currencyDecimals(currency);
}

/** Example amount for a placeholder, written as in the currency's country: "25.500", "25,500". */
export function amountExample(currency: string): string {
  return new Intl.NumberFormat(currencyLocale(currency)).format(25500);
}
