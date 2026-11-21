/** What get_merchant_report() returns, in TypeScript terms. Money in minor units. */
export type MerchantReport = {
  currency: string;
  customers: { total: number; new: number; active: number };
  purchases: { count: number; amountMinor: number };
  points: { earned: number; redeemed: number; inCirculation: number };
  redemptions: {
    count: number;
    topRewards: { rewardId: string | null; name: string; count: number; points: number }[];
  };
  /** Every branch (also with no purchases); `id: null` = purchases without a branch. */
  branches: { id: string | null; name: string | null; count: number; amountMinor: number }[];
  topCustomers: { membershipId: string; fullName: string; count: number; amountMinor: number; points: number }[];
};
