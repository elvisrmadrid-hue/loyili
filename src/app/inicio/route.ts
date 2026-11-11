import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { getHomePathForCurrentUser } from "@/modules/merchants";

/**
 * GET /inicio — landing point after signing in without a `next` parameter.
 * Sends people who belong to a merchant to their panel, everyone else to the wallet.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const path = user ? await getHomePathForCurrentUser() : "/login";
  return NextResponse.redirect(new URL(path, request.url));
}
