// Public API of the identification module (customer QR codes). Server-only: client
// components import the pure helpers from "@/modules/identification/rules" and receive
// Server Actions as props.
export { enrollCustomer, identifyCustomer, issueMyCode } from "./actions";
export { formatCountdown, formatCustomerCode, normalizeCustomerCode, RENEW_BEFORE_SECONDS } from "./rules";
export type { IssuedCode } from "./types";
