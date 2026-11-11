// Verifies Row Level Security and privileges of public.profiles against the
// linked Supabase project, acting as real users through the public Data API.
//
// Usage:  npm run verify:rls
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local.
// Never prints keys. Creates 2 throwaway users per run (sign-up is public);
// they can be deleted from the Supabase dashboard (Authentication > Users).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).");
  process.exit(1);
}

const domain = process.env.TEST_EMAIL_DOMAIN ?? "mailinator.com";
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = `Test-${runId}-pw`;

const newClient = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

async function signUp(tag, fullName) {
  const client = newClient();
  const email = `loyili-rls-${tag}-${runId}@${domain}`;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw new Error(`sign up ${tag} failed: ${error.code} ${error.message}`);
  if (!data.session) throw new Error(`sign up ${tag}: no session (is "Confirm email" still enabled?)`);
  return { client, id: data.user.id, email };
}

// 1. Anonymous visitor
{
  const anon = newClient();
  const { data, error } = await anon.from("profiles").select("id");
  check(Boolean(error) || data.length === 0, "anon cannot read profiles", error ? error.code : `${data.length} rows`);
}

// 2. Server-side password policy (min 8)
{
  const { error } = await newClient().auth.signUp({
    email: `loyili-rls-weak-${runId}@${domain}`,
    password: "1234567",
  });
  check(error?.code === "weak_password", "sign up with 7-char password is rejected", error?.code ?? "accepted!");
}

// 3. Two real users
const a = await signUp("a", "Usuaria A");
const b = await signUp("b", "  Usuario B  ");
console.log(`info  created test users ${a.email} and ${b.email}`);

// 4. Profile auto-created by trigger, trimmed name
{
  const { data, error } = await a.client.from("profiles").select("id, full_name");
  check(!error && data.length === 1 && data[0].id === a.id, "A sees exactly one profile: their own", error?.message ?? `${data.length} rows`);
  check(data?.[0]?.full_name === "Usuaria A", "A's profile has the sign-up name", data?.[0]?.full_name);

  const { data: bOwn } = await b.client.from("profiles").select("full_name").eq("id", b.id).single();
  check(bOwn?.full_name === "Usuario B", "trigger trims spaces from the name", JSON.stringify(bOwn?.full_name));
}

// 5. Isolation between users
{
  const { data } = await a.client.from("profiles").select("id").eq("id", b.id);
  check(data?.length === 0, "A cannot read B's profile", `${data?.length} rows`);

  const { data: upd, error } = await a.client
    .from("profiles")
    .update({ full_name: "Hackeado" })
    .eq("id", b.id)
    .select();
  check(Boolean(error) || upd.length === 0, "A cannot update B's profile", error?.code ?? `${upd.length} rows`);
}

// 6. Allowed and forbidden writes on own row
{
  const { data, error } = await a.client
    .from("profiles")
    .update({ full_name: "Usuaria A2" })
    .eq("id", a.id)
    .select("full_name");
  check(!error && data?.[0]?.full_name === "Usuaria A2", "A can update their own full_name", error?.message);

  const { error: idErr } = await a.client.from("profiles").update({ id: b.id }).eq("id", a.id);
  check(Boolean(idErr), "A cannot change their profile id", idErr?.code ?? "allowed!");

  const { error: tsErr } = await a.client
    .from("profiles")
    .update({ created_at: "2000-01-01T00:00:00Z" })
    .eq("id", a.id);
  check(Boolean(tsErr), "A cannot change created_at", tsErr?.code ?? "allowed!");

  const { error: insErr } = await a.client.from("profiles").insert({ id: crypto.randomUUID(), full_name: "X" });
  check(Boolean(insErr), "A cannot insert profiles", insErr?.code ?? "allowed!");

  const { data: del, error: delErr } = await a.client.from("profiles").delete().eq("id", a.id).select();
  check(Boolean(delErr) || del.length === 0, "A cannot delete their profile", delErr?.code ?? `${del.length} rows`);
}

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
