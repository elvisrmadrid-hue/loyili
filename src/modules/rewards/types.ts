/** A reward of a merchant's catalog. */
export type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  isActive: boolean;
};

/** Merchant view: also whether it has been redeemed (then it cannot be deleted). */
export type CatalogReward = Reward & { hasRedemptions: boolean };

/** What the public join page shows. */
export type PublicReward = Pick<Reward, "name" | "description" | "pointsCost">;
