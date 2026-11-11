import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/auth";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email_change",
  "email",
];

/**
 * Landing point for links sent by email (e.g. password recovery).
 * Validates the link with Supabase, which creates the session cookie,
 * then sends the user to `next` (an internal path).
 *
 * Supports both link formats:
 * - ?token_hash=...&type=recovery  (custom email template; works on any device/browser)
 * - ?code=...                      (default template, PKCE; same browser that requested it)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type && (EMAIL_OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) redirect(next);
    console.error("[auth/confirm] verifyOtp:", error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    console.error("[auth/confirm] exchangeCodeForSession:", error.code, error.message);
  }

  redirect("/recuperar?error=enlace-invalido");
}
