// Public API of the merchants module. Other parts of the app import from "@/modules/merchants".
// Server-only (it reaches next/headers through Supabase); client components import
// types only, and receive Server Actions as props.
export {
  acceptInvitation,
  createBranch,
  createInvitation,
  createMerchant,
  deleteBranch,
  removeMember,
  revokeInvitation,
  updateBranch,
  updateMerchant,
} from "./actions";
export {
  getBranches,
  getHomePathForCurrentUser,
  getInvitationPreview,
  getMembership,
  getMyMerchants,
  getPendingInvitations,
  getTeam,
} from "./queries";
export { CURRENCY_OPTIONS, currencyLabel } from "./currencies";
export type {
  Branch,
  InvitationLinkState,
  InvitationPreview,
  InvitationStatus,
  Merchant,
  MerchantMembership,
  MerchantRole,
  PendingInvitation,
  TeamMember,
} from "./types";
