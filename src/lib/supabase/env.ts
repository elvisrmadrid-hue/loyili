/**
 * Public Supabase configuration (safe for the browser).
 *
 * NEXT_PUBLIC_* variables must be read with their full literal name so that
 * Next.js can inline them into the browser bundle.
 */
export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase: define NEXT_PUBLIC_SUPABASE_URL y " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local (ver .env.example) y reinicia `npm run dev`.",
    );
  }

  return { url, publishableKey };
}

/** Base URL of the app, used to build links sent by email. */
export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
