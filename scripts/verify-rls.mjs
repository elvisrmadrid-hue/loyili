// Verifies Row Level Security and privileges (profiles, merchants, members,
// branches, invitations) against the linked Supabase project, acting as real
// users through the public Data API.
//
// Usage:  npm run verify:rls
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local.
// Never prints keys. Creates 3 throwaway users per run (sign-up is public);
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

// ===========================================================================
// Module 2 — merchants, members, branches, invitations
// ===========================================================================
console.log("\n-- Module 2: merchants --");
const c = await signUp("c", "Cajera C");
console.log(`info  created test user ${c.email}`);

const rowsOf = (result) => (result.error ? `error ${result.error.code}` : `${result.data?.length} rows`);

// 7. Creating merchants
{
  const anonCreate = await newClient().rpc("create_merchant", { p_name: "Anon", p_currency: "USD" });
  check(Boolean(anonCreate.error), "anon cannot create a merchant", anonCreate.error?.code ?? "allowed!");

  const badCurrency = await a.client.rpc("create_merchant", { p_name: "Mala moneda", p_currency: "XX" });
  check(Boolean(badCurrency.error), "invalid currency is rejected", badCurrency.error?.code ?? "allowed!");

  const emptyName = await a.client.rpc("create_merchant", { p_name: "   ", p_currency: "USD" });
  check(Boolean(emptyName.error), "empty merchant name is rejected", emptyName.error?.code ?? "allowed!");
}

const m1 = await a.client.rpc("create_merchant", { p_name: "  Café de A ", p_currency: "cop" });
const m2 = await b.client.rpc("create_merchant", { p_name: "Tienda de B", p_currency: "USD" });
if (m1.error || m2.error) throw new Error(`create_merchant failed: ${(m1.error ?? m2.error).message}`);
const m1Id = m1.data;
const m2Id = m2.data;

// 8. Isolation between merchants
{
  const own = await a.client.from("merchants").select("id, name, currency");
  check(
    own.data?.length === 1 && own.data[0].id === m1Id && own.data[0].name === "Café de A" && own.data[0].currency === "COP",
    "owner sees only their merchant (name trimmed, currency uppercased)",
    rowsOf(own),
  );

  const foreign = await b.client.from("merchants").select("id").eq("id", m1Id);
  check(foreign.data?.length === 0, "B cannot read A's merchant", rowsOf(foreign));

  const foreignUpd = await b.client.from("merchants").update({ name: "Hackeado" }).eq("id", m1Id).select();
  check(Boolean(foreignUpd.error) || foreignUpd.data.length === 0, "B cannot update A's merchant", rowsOf(foreignUpd));

  const ownUpd = await a.client
    .from("merchants")
    .update({ name: "Café de A2", currency: "MXN" })
    .eq("id", m1Id)
    .select("name, currency");
  check(ownUpd.data?.[0]?.currency === "MXN", "owner can change name and currency", rowsOf(ownUpd));

  const members = await b.client.from("merchant_members").select("user_id").eq("merchant_id", m1Id);
  check(members.data?.length === 0, "B cannot read A's team", rowsOf(members));

  const selfJoin = await b.client.from("merchant_members").insert({ merchant_id: m1Id, user_id: b.id, role: "owner" });
  check(Boolean(selfJoin.error), "B cannot add themselves to A's merchant", selfJoin.error?.code ?? "allowed!");
}

// 9. Branches
let branchId;
{
  const created = await a.client
    .from("branches")
    .insert({ merchant_id: m1Id, name: "Centro", address: "Calle 1" })
    .select("id")
    .single();
  branchId = created.data?.id;
  check(Boolean(branchId), "owner can create a branch", created.error?.message);

  const dup = await a.client.from("branches").insert({ merchant_id: m1Id, name: "centro" });
  check(dup.error?.code === "23505", "duplicate branch name (any case) is rejected", dup.error?.code ?? "allowed!");

  const foreignIns = await b.client.from("branches").insert({ merchant_id: m1Id, name: "Intrusa" });
  check(Boolean(foreignIns.error), "B cannot create a branch in A's merchant", foreignIns.error?.code ?? "allowed!");

  const foreignRead = await b.client.from("branches").select("id").eq("merchant_id", m1Id);
  check(foreignRead.data?.length === 0, "B cannot read A's branches", rowsOf(foreignRead));
}

// 10. Invitations
let token;
{
  const foreignInv = await b.client.rpc("create_merchant_invitation", { p_merchant_id: m1Id });
  check(Boolean(foreignInv.error), "B cannot create invitations for A's merchant", foreignInv.error?.code ?? "allowed!");

  const inv = await a.client.rpc("create_merchant_invitation", { p_merchant_id: m1Id });
  token = inv.data;
  check(typeof token === "string" && token.length === 43, "owner gets a 43-char invitation token", inv.error?.message);

  const hash = await a.client.from("merchant_invitations").select("token_hash").eq("merchant_id", m1Id);
  check(Boolean(hash.error), "token_hash cannot be read, not even by the owner", hash.error?.code ?? "readable!");

  const list = await a.client.from("merchant_invitations").select("id, expires_at").eq("merchant_id", m1Id);
  check(list.data?.length === 1, "owner sees the pending invitation", rowsOf(list));

  const preview = await c.client.rpc("get_invitation_preview", { p_token: token });
  check(
    preview.data?.[0]?.status === "valid" && preview.data[0].merchant_name === "Café de A2",
    "invitee sees a valid preview with the merchant name",
    JSON.stringify(preview.data ?? preview.error?.message),
  );

  const garbage = await c.client.rpc("accept_merchant_invitation", { p_token: "no-existe" });
  check(garbage.error?.message === "invitation_not_found", "unknown token is rejected", garbage.error?.message ?? "accepted!");

  const accepted = await c.client.rpc("accept_merchant_invitation", { p_token: token });
  check(accepted.data === m1Id, "invitee accepts and joins the merchant", accepted.error?.message);

  const again = await c.client.rpc("get_invitation_preview", { p_token: token });
  check(again.data?.[0]?.status === "already_member", "preview says already_member afterwards", JSON.stringify(again.data));

  const reuse = await b.client.rpc("accept_merchant_invitation", { p_token: token });
  check(reuse.error?.message === "invitation_used", "a used invitation cannot be reused", reuse.error?.message ?? "accepted!");

  const second = await a.client.rpc("create_merchant_invitation", { p_merchant_id: m1Id });
  const revoked = await a.client
    .from("merchant_invitations")
    .delete()
    .eq("merchant_id", m1Id)
    .is("accepted_at", null)
    .select("id");
  check(revoked.data?.length === 1, "owner can revoke a pending invitation", rowsOf(revoked));
  const afterRevoke = await b.client.rpc("accept_merchant_invitation", { p_token: second.data });
  check(afterRevoke.error?.message === "invitation_not_found", "a revoked invitation no longer works", afterRevoke.error?.message ?? "accepted!");
}

// 11. What staff can and cannot do
{
  const sees = await c.client.from("merchants").select("id").eq("id", m1Id);
  check(sees.data?.length === 1, "staff sees the merchant", rowsOf(sees));

  const branches = await c.client.from("branches").select("id").eq("merchant_id", m1Id);
  check(branches.data?.length === 1, "staff sees the branches", rowsOf(branches));

  const ins = await c.client.from("branches").insert({ merchant_id: m1Id, name: "De la cajera" });
  check(Boolean(ins.error), "staff cannot create branches", ins.error?.code ?? "allowed!");

  const updB = await c.client.from("branches").update({ name: "X" }).eq("id", branchId).select();
  check(Boolean(updB.error) || updB.data.length === 0, "staff cannot edit branches", rowsOf(updB));

  const updM = await c.client.from("merchants").update({ name: "X" }).eq("id", m1Id).select();
  check(Boolean(updM.error) || updM.data.length === 0, "staff cannot edit the merchant", rowsOf(updM));

  const inv = await c.client.rpc("create_merchant_invitation", { p_merchant_id: m1Id });
  check(Boolean(inv.error), "staff cannot create invitations", inv.error?.code ?? "allowed!");

  const invList = await c.client.from("merchant_invitations").select("id").eq("merchant_id", m1Id);
  check(invList.data?.length === 0, "staff cannot read invitations", rowsOf(invList));

  const team = await c.client.from("merchant_members").select("user_id").eq("merchant_id", m1Id);
  check(team.data?.length === 1 && team.data[0].user_id === c.id, "staff only sees their own membership", rowsOf(team));

  const delOwner = await c.client.from("merchant_members").delete().eq("merchant_id", m1Id).eq("user_id", a.id).select();
  check(Boolean(delOwner.error) || delOwner.data.length === 0, "staff cannot remove the owner", rowsOf(delOwner));

  const ownerProfile = await c.client.from("profiles").select("id").eq("id", a.id);
  check(ownerProfile.data?.length === 0, "staff cannot read the owner's profile", rowsOf(ownerProfile));
}

// ---------------------------------------------------------------------------
// Module 3: loyalty programs (runs while C is still staff of merchant 1)
// ---------------------------------------------------------------------------
console.log("\n-- Module 3: loyalty programs --");
const programOf = (client, merchantId) =>
  client.from("loyalty_programs").select("points_per_block, block_amount_minor, is_active").eq("merchant_id", merchantId);
const rule = (points, blockMinor) => ({ points_per_block: points, block_amount_minor: blockMinor });

// 13. Who can create a program
{
  const anonRead = await newClient().from("loyalty_programs").select("merchant_id");
  check(Boolean(anonRead.error) || anonRead.data.length === 0, "anon cannot read programs", rowsOf(anonRead));

  const byStaff = await c.client.from("loyalty_programs").insert({ merchant_id: m1Id, ...rule(1, 100000) });
  check(Boolean(byStaff.error), "staff cannot create the program", byStaff.error?.code ?? "allowed!");

  const byOther = await b.client.from("loyalty_programs").insert({ merchant_id: m1Id, ...rule(1, 100000) });
  check(Boolean(byOther.error), "another owner cannot create a program for A's merchant", byOther.error?.code ?? "allowed!");

  for (const [label, values] of [
    ["0 points", rule(0, 100000)],
    ["1001 points", rule(1001, 100000)],
    ["a zero block amount", rule(1, 0)],
    ["a negative block amount", rule(1, -100)],
  ]) {
    const bad = await a.client.from("loyalty_programs").insert({ merchant_id: m1Id, ...values });
    check(bad.error?.code === "23514", `database rejects ${label}`, bad.error?.code ?? "allowed!");
  }

  const created = await a.client
    .from("loyalty_programs")
    .insert({ merchant_id: m1Id, ...rule(1, 100000) })
    .select("is_active");
  check(created.data?.[0]?.is_active === true, "owner creates the program, active by default", rowsOf(created));

  const dup = await a.client.from("loyalty_programs").insert({ merchant_id: m1Id, ...rule(2, 100000) });
  check(dup.error?.code === "23505", "a merchant cannot have two programs", dup.error?.code ?? "allowed!");

  const own = await b.client.from("loyalty_programs").insert({ merchant_id: m2Id, ...rule(5, 1000) }).select("merchant_id");
  check(own.data?.length === 1, "each owner creates their own merchant's program", rowsOf(own));
}

// 14. Reading and editing
{
  const staffRead = await programOf(c.client, m1Id);
  check(staffRead.data?.[0]?.points_per_block === 1, "staff can read the program", rowsOf(staffRead));

  const staffUpd = await c.client.from("loyalty_programs").update(rule(9, 100)).eq("merchant_id", m1Id).select();
  check(Boolean(staffUpd.error) || staffUpd.data.length === 0, "staff cannot change the rule", rowsOf(staffUpd));

  const staffPause = await c.client.from("loyalty_programs").update({ is_active: false }).eq("merchant_id", m1Id).select();
  check(Boolean(staffPause.error) || staffPause.data.length === 0, "staff cannot pause the program", rowsOf(staffPause));

  const otherRead = await programOf(b.client, m1Id);
  check(otherRead.data?.length === 0, "another owner cannot read A's program", rowsOf(otherRead));

  const otherUpd = await b.client.from("loyalty_programs").update(rule(9, 100)).eq("merchant_id", m1Id).select();
  check(Boolean(otherUpd.error) || otherUpd.data.length === 0, "another owner cannot change A's program", rowsOf(otherUpd));

  const aReadsB = await programOf(a.client, m2Id);
  check(aReadsB.data?.length === 0, "A cannot read B's program either", rowsOf(aReadsB));

  const ownUpd = await a.client.from("loyalty_programs").update(rule(3, 500000)).eq("merchant_id", m1Id).select("points_per_block, block_amount_minor");
  check(
    ownUpd.data?.[0]?.points_per_block === 3 && Number(ownUpd.data?.[0]?.block_amount_minor) === 500000,
    "owner can change the rule",
    rowsOf(ownUpd),
  );

  const moveIt = await a.client.from("loyalty_programs").update({ merchant_id: m2Id }).eq("merchant_id", m1Id).select();
  check(Boolean(moveIt.error), "the program cannot be moved to another merchant", moveIt.error?.code ?? "allowed!");

  const pause = await a.client.from("loyalty_programs").update({ is_active: false }).eq("merchant_id", m1Id).select("is_active");
  check(pause.data?.[0]?.is_active === false, "owner can pause the program", rowsOf(pause));

  const resume = await a.client.from("loyalty_programs").update({ is_active: true }).eq("merchant_id", m1Id).select("is_active");
  check(resume.data?.[0]?.is_active === true, "owner can resume the program", rowsOf(resume));

  const del = await a.client.from("loyalty_programs").delete().eq("merchant_id", m1Id).select();
  check(Boolean(del.error) || del.data.length === 0, "nobody can delete a program (pause instead)", rowsOf(del));
}

// 15. Changing the currency pauses the program
{
  const rename = await a.client.from("merchants").update({ name: "Café de A renombrado" }).eq("id", m1Id).select("id");
  const afterRename = await programOf(a.client, m1Id);
  check(
    rename.data?.length === 1 && afterRename.data?.[0]?.is_active === true,
    "renaming the merchant keeps the program active",
    rowsOf(afterRename),
  );

  const sameCurrency = await a.client.from("merchants").update({ currency: "MXN" }).eq("id", m1Id).select("id");
  const afterSame = await programOf(a.client, m1Id);
  check(
    sameCurrency.data?.length === 1 && afterSame.data?.[0]?.is_active === true,
    "saving the same currency keeps the program active",
    rowsOf(afterSame),
  );

  const change = await a.client.from("merchants").update({ currency: "COP" }).eq("id", m1Id).select("id");
  const afterChange = await programOf(a.client, m1Id);
  check(
    change.data?.length === 1 && afterChange.data?.[0]?.is_active === false,
    "changing the currency pauses the program",
    rowsOf(afterChange),
  );
  check(afterChange.data?.[0]?.points_per_block === 3, "the rule is kept when paused", JSON.stringify(afterChange.data?.[0]));

  const bProgram = await programOf(b.client, m2Id);
  check(bProgram.data?.[0]?.is_active === true, "other merchants' programs are not affected", rowsOf(bProgram));
}

// 12. Owner managing the team
{
  const team = await a.client.from("profiles").select("full_name").eq("id", c.id);
  check(team.data?.[0]?.full_name === "Cajera C", "owner can read their staff's name", rowsOf(team));

  const outsider = await b.client.from("profiles").select("id").eq("id", c.id);
  check(outsider.data?.length === 0, "other merchants cannot read that staff's profile", rowsOf(outsider));

  const selfRemove = await a.client.from("merchant_members").delete().eq("merchant_id", m1Id).eq("user_id", a.id).select();
  check(Boolean(selfRemove.error) || selfRemove.data.length === 0, "the owner row cannot be deleted", rowsOf(selfRemove));

  const removed = await a.client.from("merchant_members").delete().eq("merchant_id", m1Id).eq("user_id", c.id).select();
  check(removed.data?.length === 1, "owner can remove staff", rowsOf(removed));

  const lost = await c.client.from("merchants").select("id").eq("id", m1Id);
  check(lost.data?.length === 0, "removed staff loses access immediately", rowsOf(lost));

  const delBranch = await a.client.from("branches").delete().eq("id", branchId).select("id");
  check(delBranch.data?.length === 1, "owner can delete a branch", rowsOf(delBranch));

  const delMerchant = await a.client.from("merchants").delete().eq("id", m1Id).select();
  check(Boolean(delMerchant.error) || delMerchant.data.length === 0, "nobody can delete a merchant (out of scope)", rowsOf(delMerchant));
}

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
