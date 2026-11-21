// Read-only check of the PRODUCTION project and the published site. Creates nothing:
// unlike verify:rls, it never signs anyone up (test data in production could never be
// deleted, because the ledger is append-only).
//
// Usage:  npm run verify:prod
// Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and NEXT_PUBLIC_SITE_URL
// from .env.production.local (only public values; see docs/despliegue.md). Never prints keys.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
if (!url || !key || !site) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SITE_URL (.env.production.local).");
  process.exit(1);
}

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// -- Database: a visitor without a session reads nothing --------------------
console.log(`-- Supabase: ${new URL(url).host} --`);
const tables = [
  "profiles", "merchants", "merchant_members", "branches", "merchant_invitations",
  "loyalty_programs", "memberships", "point_transactions", "rewards", "customer_codes",
];
for (const table of tables) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  // A missing table would also "hide" data: it must exist (permission error, not "not found").
  const missing = error && (error.code === "42P01" || error.code === "PGRST205");
  check(!missing && (Boolean(error) || data.length === 0), `anon cannot read ${table}`, missing ? "TABLE MISSING (migrations not applied?)" : error ? error.code : `${data.length} rows`);
}

// Public functions exist and reveal nothing for an unknown code.
{
  const preview = await anon.rpc("get_join_preview", { p_code: "ZZZZZZ" });
  check(!preview.error && preview.data.length === 0, "get_join_preview exists and an unknown code shows nothing", preview.error?.message);
  const rewards = await anon.rpc("get_public_rewards", { p_code: "ZZZZZZ" });
  check(!rewards.error && rewards.data.length === 0, "get_public_rewards exists and an unknown code shows nothing", rewards.error?.message);
}

// Functions that need a session refuse anonymous calls (and exist: the latest migrations are applied).
for (const [fn, args] of [
  ["record_purchase", { p_membership_id: crypto.randomUUID(), p_amount_minor: 100, p_branch_id: null, p_idempotency_key: crypto.randomUUID() }],
  ["redeem_reward", { p_membership_id: crypto.randomUUID(), p_reward_id: crypto.randomUUID(), p_idempotency_key: crypto.randomUUID() }],
  ["issue_customer_code", {}],
  ["get_merchant_report", { p_merchant_id: crypto.randomUUID(), p_days: 30 }],
]) {
  const { error } = await anon.rpc(fn, args);
  const missing = error?.code === "PGRST202";
  check(Boolean(error) && !missing, `${fn} exists and refuses visitors`, missing ? "FUNCTION MISSING (migrations not applied?)" : error?.code ?? "allowed!");
}

// Auth settings: the 8-character minimum is enforced (the rejected sign-up creates nothing).
{
  const { error } = await anon.auth.signUp({ email: `loyili-verify-${Date.now()}@example.com`, password: "1234567" });
  check(error?.code === "weak_password", "sign-up with a 7-character password is rejected", error?.code ?? "accepted!");
}

// -- Published site ---------------------------------------------------------
console.log(`\n-- Site: ${site} --`);
check(site.startsWith("https://"), "the site uses HTTPS", site);
{
  const res = await fetch(`${site}/login`);
  check(res.status === 200, "the login page loads", `status ${res.status}`);
  const h = (name) => res.headers.get(name) ?? "";
  check(h("x-frame-options") === "DENY", "X-Frame-Options: DENY", h("x-frame-options"));
  check(h("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff", h("x-content-type-options"));
  check(h("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy", h("referrer-policy"));
  check(h("permissions-policy").includes("camera=(self)"), "Permissions-Policy allows the camera only for Loyili", h("permissions-policy"));
  check(h("strict-transport-security").includes("max-age"), "HSTS (always HTTPS) is on", h("strict-transport-security") || "missing");
  const html = await res.text();
  check(!/sb_secret_|service_role/i.test(html), "no secret key appears in the page");
}
{
  const res = await fetch(`${site}/manifest.webmanifest`);
  const manifest = res.ok ? await res.json() : null;
  check(manifest?.start_url === "/inicio" && manifest?.icons?.length === 3, "the app manifest is published (installable)", `status ${res.status}`);
}
{
  const res = await fetch(`${site}/wallet`, { redirect: "manual" });
  check(res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/login"), "private pages send visitors to the login", `status ${res.status}`);
}

console.log(failures === 0 ? "\nAll production checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
