import { notFound } from "next/navigation";
import { getMembership } from "@/modules/merchants";

/**
 * Membership for a merchant page, or a 404 if the user is not a member
 * (or not the owner, for owner-only sections). Cached per request, so the
 * layout and the page share one database query.
 */
export async function loadMembership(merchantId: string, { ownerOnly = false } = {}) {
  const membership = await getMembership(merchantId);
  if (!membership || (ownerOnly && membership.role !== "owner")) notFound();
  return membership;
}
