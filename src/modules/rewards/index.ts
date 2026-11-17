// Public API of the rewards module. Other parts of the app import from "@/modules/rewards".
// Server-only (it reaches next/headers through Supabase); client components receive
// Server Actions as props and import only types.
export { createReward, deleteReward, redeemReward, setRewardActive, updateReward } from "./actions";
export { getActiveRewards, getPublicRewards, getRewards } from "./queries";
export { REWARD_COST_MAX, REWARD_COST_MIN } from "./schemas";
export type { CatalogReward, PublicReward, Reward } from "./types";
