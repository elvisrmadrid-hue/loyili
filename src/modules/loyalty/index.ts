// Public API of the loyalty module. Other parts of the app import from "@/modules/loyalty".
// Server-only (it reaches next/headers through Supabase). Client components import the
// pure helpers from "@/modules/loyalty/rules" (no server code) and receive Server Actions as props.
export { saveLoyaltyProgram, setLoyaltyProgramActive } from "./actions";
export { getLoyaltyProgram } from "./queries";
export { calculatePoints, describeRule, formatPoints, fromMinorUnits, toMinorUnits } from "./rules";
export type { EarningRule } from "./rules";
export type { LoyaltyProgram } from "./types";
