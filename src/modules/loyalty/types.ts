import type { EarningRule } from "./rules";

/** A merchant's loyalty program (Module 3: only the earning rule and its status). */
export type LoyaltyProgram = EarningRule & {
  merchantId: string;
  isActive: boolean;
  /** ISO date (UTC). */
  updatedAt: string;
};
