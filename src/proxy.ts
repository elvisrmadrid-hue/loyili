import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isGuestOnlyPath, isProtectedPath, safeNextPath } from "@/modules/auth/redirects";

/**
 * Runs before every matched request:
 * 1. Keeps the Supabase session fresh (refreshed cookies travel with the response).
 * 2. Optimistic redirects: guests away from private areas, signed-in users away from login/sign-up.
 *
 * This is NOT the definitive authorization check: protected pages call requireUser().
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search, searchParams } = request.nextUrl;

  if (!userId && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(loginUrl, response);
  }

  // Already signed in: skip login/sign-up and go where they were heading (e.g. an invitation).
  if (userId && isGuestOnlyPath(pathname)) {
    const next = safeNextPath(searchParams.get("next"));
    return redirectKeepingCookies(new URL(next, request.url), response);
  }

  return response;
}

/** A redirect must carry the auth cookies that updateSession may have refreshed. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files (images, icons, etc.).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
