// Public API of the customers module. Other parts of the app import from "@/modules/customers".
// Server-only (it reaches next/headers through Supabase). Client components import the
// pure helpers from "@/modules/customers/rules" and receive Server Actions as props.
export { joinMerchant } from "./actions";
export { getCustomerCount, getCustomers, getJoinPreview, getMyMemberships } from "./queries";
export { joinPath, normalizeJoinCode } from "./rules";
export type {
  Customer,
  JoinPreview,
  JoinViewerStatus,
  ProgramStatus,
  WalletMembership,
} from "./types";
