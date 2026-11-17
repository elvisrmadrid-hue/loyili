export type TransactionType = "EARN" | "REVERSAL";

/** One movement of a membership's points history. */
export type Transaction = {
  id: string;
  type: TransactionType;
  /** Signed: positive for purchases, negative for reversals. */
  points: number;
  /** Purchase amount in minor units (purchases only). */
  purchaseAmountMinor: number | null;
  currency: string;
  /** Reversal reason. */
  note: string | null;
  /** ISO date (UTC). */
  createdAt: string;
  /** Branch name (merchant view only; customers cannot read branches). */
  branchName: string | null;
  /** Who recorded it (only readable by the owner). */
  authorName: string | null;
  /** Purchases: whether it has been reversed. */
  reversed: boolean;
};
