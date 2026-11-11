import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  DEFAULT_AFTER_SIGN_IN,
  isGuestOnlyPath,
  isProtectedPath,
} from "@/modules/auth/redirects";

/**
 * Runs before every matched request:
 * 1. Keeps the Supabase session fresh (refreshed cookies travel with the response).
 * 2. Optimistic redirects: guests away from private areas, signed-in users away from login/sign-up.
 *
 * This is NOT the definitive authorization check: protected pages call requireUser().
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(loginUrl, response);
  }

  if (userId && isGuestOnlyPath(pathname)) {
    return redirectKeepingCookies(new URL(DEFAULT_AFTER_SIGN_IN, request.url), response);
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
