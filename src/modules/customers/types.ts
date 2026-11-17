import type { EarningRule } from "@/modules/loyalty";

export type ProgramStatus = "active" | "paused" | "none";

/** Who is looking at the join page: signed out, a possible customer, already a customer, or staff/owner. */
export type JoinViewerStatus = "anonymous" | "none" | "customer" | "member";

/** What /unirse/<code> shows. */
export type JoinPreview = {
  code: string;
  merchantName: string;
  currency: string;
  rule: EarningRule | null;
  programStatus: ProgramStatus;
  viewerStatus: JoinViewerStatus;
};

/** One program in the customer's wallet. */
export type WalletMembership = {
  id: string;
  merchantId: string;
  merchantName: string;
  currency: string;
  /** ISO date (UTC). */
  joinedAt: string;
  program: (EarningRule & { isActive: boolean }) | null;
};

/** One customer in a merchant's list (only name and date, by design). */
export type Customer = {
  membershipId: string;
  fullName: string;
  /** ISO date (UTC). */
  joinedAt: string;
};
