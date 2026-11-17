export type MerchantRole = "owner" | "staff";

export type Merchant = {
  id: string;
  name: string;
  currency: string;
  /** Public code customers use to join (/unirse/<code>). */
  joinCode: string;
};

/** A merchant seen by one of its members, with that member's role. */
export type MerchantMembership = Merchant & { role: MerchantRole };

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  /** Branches with purchases cannot be deleted (Module 5). */
  hasPurchases: boolean;
};

export type TeamMember = {
  userId: string;
  fullName: string;
  role: MerchantRole;
  /** ISO date (UTC). */
  joinedAt: string;
};

export type PendingInvitation = {
  id: string;
  /** ISO dates (UTC). */
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};

export type InvitationStatus = "valid" | "already_member" | "expired" | "used" | "not_found";

export type InvitationPreview = {
  status: InvitationStatus;
  /** Only present when status is "valid" or "already_member". */
  merchantName: string | null;
};

/** State of the "generate invitation link" form. */
export type InvitationLinkState = { error?: string; url?: string } | undefined;
