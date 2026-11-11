"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath } from "./redirects";
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "./schemas";
import type { AuthFormState } from "./types";

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

/** Translates Supabase Auth errors into Spanish messages for the user. */
function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.";
    case "weak_password":
      return "La contraseña es demasiado débil. Prueba con una más larga.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la anterior.";
    case "email_address_invalid":
      return "Ese email no es válido.";
    case "email_not_confirmed":
      return "Debes confirmar tu email antes de iniciar sesión.";
    case "signup_disabled":
      return "El registro de cuentas nuevas está desactivado.";
    case "over_email_send_rate_limit":
      return "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.";
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    default:
      console.error("[auth] Unexpected Supabase Auth error:", error.code, error.message);
      return "No se pudo completar la operación. Inténtalo de nuevo.";
  }
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { fullName: field(formData, "fullName"), email: field(formData, "email") };
  const next = safeNextPath(field(formData, "next"));
  const parsed = signUpSchema.safeParse({ ...values, password: field(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { error: authErrorMessage(error), values };

  // With "Confirm email" disabled, Supabase returns a session right away.
  // If it is ever enabled again, there is no session until the user confirms.
  if (!data.session) {
    return { message: "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada." };
  }

  redirect(next);
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: field(formData, "email") };
  const next = safeNextPath(field(formData, "next"));
  const parsed = signInSchema.safeParse({ ...values, password: field(formData, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: field(formData, "email") };
  const parsed = requestPasswordResetSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/restablecer`,
  });

  // Rate limits are worth telling the user; any other outcome gets the same
  // generic message so nobody can find out which emails have an account.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: authErrorMessage(error), values };
  }
  if (error) console.error("[auth] resetPasswordForEmail:", error.code, error.message);

  return {
    message:
      "Si existe una cuenta con ese email, te enviamos un enlace para crear una nueva contraseña. Revisa tu correo (y la carpeta de spam).",
  };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { error: "El enlace expiró o no es válido. Solicita uno nuevo desde «¿Olvidaste tu contraseña?»." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };

  redirect(DEFAULT_AFTER_SIGN_IN);
}
