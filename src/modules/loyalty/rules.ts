// Pure earning-rule logic (no database, no server code), shared by the server and the
// in-browser example calculator. Covered by rules.test.ts.
import { currencyDecimals, currencyLocale, formatWholeAmount } from "@/lib/currencies";

/** "pointsPerBlock points for every blockAmountMinor spent" (amounts in minor units). */
export type EarningRule = {
  pointsPerBlock: number;
  blockAmountMinor: number;
};

export const POINTS_PER_BLOCK_MIN = 1;
export const POINTS_PER_BLOCK_MAX = 1000;
export const BLOCK_AMOUNT_MIN = 1;
export const BLOCK_AMOUNT_MAX = 100_000_000;

/**
 * Points earned by a purchase, rounding down (only complete blocks count):
 *   floor(amountMinor / blockAmountMinor) * pointsPerBlock
 * Integer math with BigInt, so large amounts never suffer floating-point errors.
 * Module 5 applies the same formula inside PostgreSQL.
 */
export function calculatePoints(amountMinor: number, rule: EarningRule): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 0;
  if (!Number.isSafeInteger(rule.blockAmountMinor) || rule.blockAmountMinor <= 0) return 0;
  const blocks = BigInt(amountMinor) / BigInt(rule.blockAmountMinor);
  return Number(blocks * BigInt(rule.pointsPerBlock));
}

/** Whole currency units to minor units: 1000 COP -> 100000; 1000 CLP -> 1000. */
export function toMinorUnits(units: number, currency: string): number {
  return units * 10 ** currencyDecimals(currency);
}

/** Minor units back to currency units: 100000 COP -> 1000. */
export function fromMinorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyDecimals(currency);
}

/**
 * Parses a whole amount typed by a person. Accepts plain digits ("1000") or digits
 * grouped in thousands with ".", "," or spaces ("1.000", "1,000", "1 000").
 * Returns null for anything else, including decimals ("1,50", "12.5"), so a decimal
 * is never silently read as a bigger number.
 */
export function parseWholeAmount(text: string): number | null {
  const value = text.trim();
  if (!/^(\d+|\d{1,3}([.,\s]\d{3})+)$/.test(value)) return null;
  const units = Number(value.replace(/[.,\s]/g, ""));
  return Number.isSafeInteger(units) ? units : null;
}

/** "1 punto", "1.500 puntos" (number written the way the currency's country does). */
export function formatPoints(points: number, currency: string): string {
  const number = new Intl.NumberFormat(currencyLocale(currency)).format(points);
  return `${number} ${points === 1 ? "punto" : "puntos"}`;
}

/** The rule in one sentence fragment: "1 punto por cada $ 1.000". */
export function describeRule(rule: EarningRule, currency: string): string {
  const amount = formatWholeAmount(fromMinorUnits(rule.blockAmountMinor, currency), currency);
  return `${formatPoints(rule.pointsPerBlock, currency)} por cada ${amount}`;
}
