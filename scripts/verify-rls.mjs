// Verifies Row Level Security and privileges (profiles, merchants, members,
// branches, invitations, programs, customers, ledger, rewards, customer codes) against the linked Supabase project, acting as real
// users through the public Data API.
//
// Usage:  npm run verify:rls
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local.
// Never prints keys. Creates 5 throwaway users per run (sign-up is public);
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

// ---------------------------------------------------------------------------
// Module 4: customers and memberships (runs while C is still staff of merchant 1)
// State here: merchant 1 (owner A, staff C) has its program PAUSED; merchant 2 (owner B) is active.
// ---------------------------------------------------------------------------
console.log("\n-- Module 4: customers --");
const d = await signUp("d", "Cliente D");
console.log(`info  created test user ${d.email}`);
const joinCodeOf = async (client, merchantId) =>
  (await client.from("merchants").select("join_code").eq("id", merchantId)).data?.[0]?.join_code;
const code1 = await joinCodeOf(a.client, m1Id);
const code2 = await joinCodeOf(b.client, m2Id);

// 16. Join codes and the public preview
{
  check(/^[A-HJ-NP-Z2-9]{6}$/.test(code1 ?? "") && /^[A-HJ-NP-Z2-9]{6}$/.test(code2 ?? ""), "merchants get a 6-char join code", `${code1} ${code2}`);
  check(code1 !== code2, "join codes are different per merchant", `${code1} ${code2}`);

  const anonPreview = await newClient().rpc("get_join_preview", { p_code: code2 });
  const row = anonPreview.data?.[0];
  check(
    row?.merchant_name === "Tienda de B" && row?.program_status === "active" && row?.viewer_status === "anonymous",
    "anyone (signed out) can preview a merchant by its code",
    anonPreview.error?.message ?? JSON.stringify(row),
  );
  check(Object.keys(row ?? {}).length === 6 && !("id" in (row ?? {})), "the preview exposes only name, currency, rule and status", Object.keys(row ?? {}).join(","));

  const lower = await newClient().rpc("get_join_preview", { p_code: ` ${code2.toLowerCase()} ` });
  check(lower.data?.length === 1, "codes are accepted in lowercase and with spaces", rowsOf(lower));

  const unknown = await newClient().rpc("get_join_preview", { p_code: "ZZZZZZ" === code1 || "ZZZZZZ" === code2 ? "YYYYYY" : "ZZZZZZ" });
  check(unknown.data?.length === 0, "an unknown code previews nothing", rowsOf(unknown));

  const paused = await d.client.rpc("get_join_preview", { p_code: code1 });
  check(paused.data?.[0]?.program_status === "paused" && paused.data?.[0]?.viewer_status === "none", "preview reports a paused program", JSON.stringify(paused.data?.[0]));

  const anonJoin = await newClient().rpc("join_merchant", { p_code: code2 });
  check(Boolean(anonJoin.error), "signed-out visitors cannot join", anonJoin.error?.code ?? "allowed!");

  const changeCode = await a.client.from("merchants").update({ join_code: "ABCDEF" }).eq("id", m1Id).select();
  check(Boolean(changeCode.error), "the owner cannot change the join code (out of scope)", changeCode.error?.code ?? "allowed!");
}

// 17. Joining
{
  const joined = await d.client.rpc("join_merchant", { p_code: code2 });
  check(joined.data === m2Id, "a customer joins an active program", joined.error?.message);

  const again = await d.client.rpc("join_merchant", { p_code: code2.toLowerCase() });
  const mine = await d.client.from("memberships").select("id").eq("merchant_id", m2Id);
  check(again.data === m2Id && mine.data?.length === 1, "joining twice does not duplicate the membership", rowsOf(mine));

  const asCustomer = await d.client.rpc("get_join_preview", { p_code: code2 });
  check(asCustomer.data?.[0]?.viewer_status === "customer", "preview recognizes an existing customer", JSON.stringify(asCustomer.data?.[0]));

  const pausedJoin = await d.client.rpc("join_merchant", { p_code: code1 });
  check(pausedJoin.error?.message === "program_not_active", "nobody can join a paused program", pausedJoin.error?.message ?? "allowed!");

  const ownerJoin = await b.client.rpc("join_merchant", { p_code: code2 });
  check(ownerJoin.error?.message === "merchant_member", "an owner cannot join their own merchant", ownerJoin.error?.message ?? "allowed!");

  const memberPreview = await b.client.rpc("get_join_preview", { p_code: code2 });
  check(memberPreview.data?.[0]?.viewer_status === "member", "preview recognizes owner/staff", JSON.stringify(memberPreview.data?.[0]));

  await a.client.from("loyalty_programs").update({ is_active: true }).eq("merchant_id", m1Id);

  const staffJoin = await c.client.rpc("join_merchant", { p_code: code1 });
  check(staffJoin.error?.message === "merchant_member", "staff cannot join the merchant they work at", staffJoin.error?.message ?? "allowed!");

  const otherMerchant = await a.client.rpc("join_merchant", { p_code: code2 });
  check(otherMerchant.data === m2Id, "an owner can be a customer of another merchant", otherMerchant.error?.message);

  const second = await d.client.rpc("join_merchant", { p_code: code1 });
  check(second.data === m1Id, "a customer can join several merchants", second.error?.message);

  const badCode = await d.client.rpc("join_merchant", { p_code: "ZZZZZZ" === code1 || "ZZZZZZ" === code2 ? "YYYYYY" : "ZZZZZZ" });
  check(badCode.error?.message === "join_code_not_found", "an unknown code cannot be joined", badCode.error?.message ?? "allowed!");

  const direct = await c.client.from("memberships").insert({ merchant_id: m2Id, customer_id: c.id });
  check(Boolean(direct.error), "memberships cannot be inserted directly", direct.error?.code ?? "allowed!");

  const leave = await d.client.from("memberships").delete().eq("customer_id", d.id).select();
  check(Boolean(leave.error) || leave.data.length === 0, "customers cannot delete memberships (leaving is out of scope)", rowsOf(leave));

  const kick = await b.client.from("memberships").delete().eq("merchant_id", m2Id).select();
  check(Boolean(kick.error) || kick.data.length === 0, "owners cannot delete memberships either", rowsOf(kick));
}

// 18. Who sees what
{
  const wallet = await d.client.from("memberships").select("merchant_id");
  check(wallet.data?.length === 2, "a customer sees only their own memberships", rowsOf(wallet));

  const merchants = await d.client.from("merchants").select("name").in("id", [m1Id, m2Id]);
  check(merchants.data?.length === 2, "a customer can read the name of their merchants", rowsOf(merchants));

  const programs = await d.client.from("loyalty_programs").select("points_per_block").in("merchant_id", [m1Id, m2Id]);
  check(programs.data?.length === 2, "a customer can read the rule of their merchants", rowsOf(programs));

  const branches = await d.client.from("branches").select("id").eq("merchant_id", m1Id);
  check(branches.data?.length === 0, "a customer cannot read branches", rowsOf(branches));

  const team = await d.client.from("merchant_members").select("user_id").eq("merchant_id", m1Id);
  check(team.data?.length === 0, "a customer cannot read the team", rowsOf(team));

  const invitations = await d.client.from("merchant_invitations").select("id").eq("merchant_id", m1Id);
  check(invitations.data?.length === 0, "a customer cannot read invitations", rowsOf(invitations));

  const others = await d.client.from("memberships").select("customer_id").eq("merchant_id", m2Id);
  check(others.data?.length === 1 && others.data[0].customer_id === d.id, "a customer cannot see other customers", rowsOf(others));

  const otherProfile = await d.client.from("profiles").select("id").eq("id", a.id);
  check(otherProfile.data?.length === 0, "a customer cannot read other customers' profiles", rowsOf(otherProfile));

  const updMerchant = await d.client.from("merchants").update({ name: "Hackeado" }).eq("id", m2Id).select();
  check(Boolean(updMerchant.error) || updMerchant.data.length === 0, "a customer cannot edit the merchant", rowsOf(updMerchant));

  const updProgram = await d.client.from("loyalty_programs").update({ points_per_block: 1000 }).eq("merchant_id", m2Id).select();
  check(Boolean(updProgram.error) || updProgram.data.length === 0, "a customer cannot edit the program", rowsOf(updProgram));

  const ownerList = await b.client.from("memberships").select("customer_id").eq("merchant_id", m2Id);
  check(ownerList.data?.length === 2, "the owner sees all their customers", rowsOf(ownerList));

  const ownerNames = await b.client.from("profiles").select("full_name").in("id", [d.id, a.id]);
  check(ownerNames.data?.length === 2, "the owner can read their customers' names", rowsOf(ownerNames));

  const staffList = await c.client.from("memberships").select("customer_id").eq("merchant_id", m1Id);
  const staffName = await c.client.from("profiles").select("full_name").eq("id", d.id);
  check(
    staffList.data?.length === 1 && staffName.data?.[0]?.full_name === "Cliente D",
    "staff see their merchant's customers and their names",
    `${rowsOf(staffList)}, ${rowsOf(staffName)}`,
  );

  const crossList = await b.client.from("memberships").select("id").eq("merchant_id", m1Id);
  check(crossList.data?.length === 0, "a merchant cannot see another merchant's customers", rowsOf(crossList));

  const staffOther = await c.client.from("memberships").select("id").eq("merchant_id", m2Id);
  check(staffOther.data?.length === 0, "staff cannot see customers of other merchants", rowsOf(staffOther));
}

// ---------------------------------------------------------------------------
// Module 5: points ledger (runs while C is still staff of merchant 1)
// State here: merchant 1 (COP, active, 3 points per 500000 minor = $5.000, has branch
// `branchId`); merchant 2 (USD, active, 5 points per 1000 minor = $10, no branches).
// D is a customer of both merchants; A is a customer of merchant 2.
// ---------------------------------------------------------------------------
console.log("\n-- Module 5: points ledger --");
const membershipOf = async (client, merchantId, customerId) =>
  (await client.from("memberships").select("id").eq("merchant_id", merchantId).eq("customer_id", customerId)).data?.[0]?.id;
const dIn1 = await membershipOf(a.client, m1Id, d.id);
const dIn2 = await membershipOf(b.client, m2Id, d.id);
const aIn2 = await membershipOf(b.client, m2Id, a.id);
const balanceOf = async (client, membershipId) =>
  (await client.from("memberships").select("points_balance").eq("id", membershipId)).data?.[0]?.points_balance;
const purchase = (client, membershipId, amountMinor, branch = null, key = crypto.randomUUID()) =>
  client.rpc("record_purchase", {
    p_membership_id: membershipId,
    p_amount_minor: amountMinor,
    p_branch_id: branch,
    p_idempotency_key: key,
  });
// Same formula as calculatePoints() in src/modules/loyalty/rules.ts (its Vitest examples).
const expectedPoints = (amountMinor, pointsPerBlock, blockMinor) =>
  Number((BigInt(amountMinor) / BigInt(blockMinor)) * BigInt(pointsPerBlock));
let firstPurchaseId;

// 19. Recording purchases
{
  // The database calculation matches the app's formula (merchant 2: 5 points per $10).
  let ok = true;
  const details = [];
  for (const amount of [999, 1000, 2700, 123456]) {
    const r = await purchase(b.client, dIn2, amount);
    const got = r.data?.[0]?.earned_points;
    const want = expectedPoints(amount, 5, 1000);
    if (got !== want) ok = false;
    details.push(`${amount}->${got ?? r.error?.message}/${want}`);
  }
  check(ok, "database points match the app formula (rounding down)", details.join(" "));
  check((await balanceOf(d.client, dIn2)) === 0 + 5 + 10 + 615, "the balance adds up the earned points", String(await balanceOf(d.client, dIn2)));

  const zero = await purchase(b.client, dIn2, 500);
  check(zero.data?.[0]?.earned_points === 0 && Boolean(zero.data?.[0]?.transaction_id), "a purchase below one block is recorded with 0 points", zero.error?.message);

  const byStaff = await purchase(c.client, dIn1, 1270000, branchId);
  firstPurchaseId = byStaff.data?.[0]?.transaction_id;
  check(byStaff.data?.[0]?.earned_points === 6, "staff record a purchase in their merchant (with branch)", byStaff.error?.message ?? JSON.stringify(byStaff.data));

  const key = crypto.randomUUID();
  const once = await purchase(a.client, dIn1, 1000000, branchId, key);
  const twice = await purchase(a.client, dIn1, 1000000, branchId, key);
  const countKey = await a.client.from("point_transactions").select("id").eq("idempotency_key", key);
  check(
    once.data?.[0]?.transaction_id === twice.data?.[0]?.transaction_id && countKey.data?.length === 1,
    "the same idempotency key records the purchase only once",
    rowsOf(countKey),
  );
  check(twice.data?.[0]?.balance === once.data?.[0]?.balance, "a replay does not change the balance", JSON.stringify(twice.data));

  const conflict = await purchase(a.client, dIn1, 999999, branchId, key);
  check(conflict.error?.message === "idempotency_conflict", "reusing a key for a different purchase is rejected", conflict.error?.message ?? "allowed!");

  const noBranch = await purchase(a.client, dIn1, 1000000);
  check(noBranch.error?.message === "branch_required", "a branch is required when the merchant has branches", noBranch.error?.message ?? "allowed!");

  const otherBranch = await b.client.from("branches").insert({ merchant_id: m2Id, name: "Sucursal de B" }).select("id");
  const foreignBranch = await purchase(a.client, dIn1, 1000000, otherBranch.data?.[0]?.id);
  check(foreignBranch.error?.message === "invalid_branch", "another merchant's branch is rejected", foreignBranch.error?.message ?? "allowed!");
  await b.client.from("branches").delete().eq("id", otherBranch.data?.[0]?.id);

  for (const [label, amount] of [["zero", 0], ["negative", -500], ["huge", 10000000001]]) {
    const bad = await purchase(a.client, dIn1, amount, branchId);
    check(bad.error?.message === "invalid_amount", `a ${label} amount is rejected`, bad.error?.message ?? "allowed!");
  }

  const self = await purchase(d.client, dIn2, 100000);
  check(self.error?.message === "not_allowed", "a customer cannot credit points to themselves", self.error?.message ?? "allowed!");

  const foreign = await purchase(b.client, dIn1, 100000, branchId);
  check(foreign.error?.message === "not_allowed", "another merchant cannot record purchases here", foreign.error?.message ?? "allowed!");

  const anon = await purchase(newClient(), dIn2, 100000);
  check(Boolean(anon.error), "signed-out visitors cannot record purchases", anon.error?.message ?? "allowed!");

  await b.client.from("loyalty_programs").update({ is_active: false }).eq("merchant_id", m2Id);
  const paused = await purchase(b.client, dIn2, 100000);
  check(paused.error?.message === "program_not_active", "no purchases while the program is paused", paused.error?.message ?? "allowed!");
  await b.client.from("loyalty_programs").update({ is_active: true }).eq("merchant_id", m2Id);

  const aBuys = await purchase(b.client, aIn2, 5000);
  check(aBuys.data?.[0]?.earned_points === 25, "each customer has their own balance", aBuys.error?.message);
}

// 20. The ledger cannot be tampered with
{
  const insert = await b.client.from("point_transactions").insert({
    merchant_id: m2Id, membership_id: dIn2, type: "EARN", points: 1000, currency: "USD", created_by: b.id,
  });
  check(Boolean(insert.error), "nobody inserts movements directly", insert.error?.code ?? "allowed!");

  const update = await b.client.from("point_transactions").update({ points: 9999 }).eq("membership_id", dIn2).select();
  check(Boolean(update.error) || update.data.length === 0, "nobody updates movements", rowsOf(update));

  const del = await b.client.from("point_transactions").delete().eq("membership_id", dIn2).select();
  check(Boolean(del.error) || del.data.length === 0, "nobody deletes movements", rowsOf(del));

  const setBalance = await b.client.from("memberships").update({ points_balance: 99999 }).eq("id", dIn2).select();
  check(Boolean(setBalance.error) || setBalance.data.length === 0, "nobody sets a balance directly (owner)", rowsOf(setBalance));

  const selfBalance = await d.client.from("memberships").update({ points_balance: 99999 }).eq("id", dIn2).select();
  check(Boolean(selfBalance.error) || selfBalance.data.length === 0, "nobody sets a balance directly (customer)", rowsOf(selfBalance));
}

// 21. Reversals
{
  const byStaff = await c.client.rpc("reverse_transaction", { p_transaction_id: firstPurchaseId, p_reason: "Error de monto" });
  check(byStaff.error?.message === "not_allowed", "staff cannot reverse purchases", byStaff.error?.message ?? "allowed!");

  const byOther = await b.client.rpc("reverse_transaction", { p_transaction_id: firstPurchaseId, p_reason: "Error de monto" });
  check(byOther.error?.message === "not_allowed", "another merchant cannot reverse purchases here", byOther.error?.message ?? "allowed!");

  const noReason = await a.client.rpc("reverse_transaction", { p_transaction_id: firstPurchaseId, p_reason: "  " });
  check(noReason.error?.message === "invalid_reason", "a reason is required", noReason.error?.message ?? "allowed!");

  const before = await balanceOf(a.client, dIn1);
  const reversed = await a.client.rpc("reverse_transaction", { p_transaction_id: firstPurchaseId, p_reason: " Monto equivocado " });
  check(
    reversed.data?.[0]?.reversed_points === -6 && reversed.data?.[0]?.balance === before - 6,
    "the owner reverses a purchase and its points are deducted",
    reversed.error?.message ?? JSON.stringify(reversed.data),
  );

  const row = await a.client.from("point_transactions").select("note, reference_id, branch_id").eq("id", reversed.data?.[0]?.reversal_id);
  check(
    row.data?.[0]?.note === "Monto equivocado" && row.data?.[0]?.reference_id === firstPurchaseId && row.data?.[0]?.branch_id === branchId,
    "the reversal keeps the reason, the original purchase and its branch",
    JSON.stringify(row.data?.[0]),
  );

  const again = await a.client.rpc("reverse_transaction", { p_transaction_id: firstPurchaseId, p_reason: "Otra vez" });
  check(again.error?.message === "already_reversed", "a purchase can be reversed only once", again.error?.message ?? "allowed!");

  const ofReversal = await a.client.rpc("reverse_transaction", { p_transaction_id: reversed.data?.[0]?.reversal_id, p_reason: "Deshacer" });
  check(ofReversal.error?.message === "not_reversible", "a reversal cannot be reversed", ofReversal.error?.message ?? "allowed!");
}

// 22. Who sees which movements, and the balance always matches the ledger
{
  const mine = await d.client.from("point_transactions").select("membership_id");
  check(
    mine.data?.length > 0 && mine.data.every((t) => t.membership_id === dIn1 || t.membership_id === dIn2),
    "a customer sees only their own movements",
    rowsOf(mine),
  );

  const aSees = await a.client.from("point_transactions").select("id").eq("membership_id", dIn2);
  check(aSees.data?.length === 0, "another customer cannot see those movements", rowsOf(aSees));

  const bSees = await b.client.from("point_transactions").select("merchant_id");
  check(bSees.data?.length > 0 && bSees.data.every((t) => t.merchant_id === m2Id), "a merchant sees only its own movements", rowsOf(bSees));

  const staffSees = await c.client.from("point_transactions").select("id").eq("merchant_id", m1Id);
  check(staffSees.data?.length === 3, "staff see their merchant's movements", rowsOf(staffSees));

  const anonSees = await newClient().from("point_transactions").select("id");
  check(Boolean(anonSees.error) || anonSees.data.length === 0, "signed-out visitors see no movements", rowsOf(anonSees));

  let consistent = true;
  const summary = [];
  for (const [client, id] of [[a.client, dIn1], [b.client, dIn2], [b.client, aIn2]]) {
    const moves = await client.from("point_transactions").select("points").eq("membership_id", id);
    const sum = moves.data.reduce((total, t) => total + t.points, 0);
    const balance = await balanceOf(client, id);
    if (sum !== balance) consistent = false;
    summary.push(`${sum}/${balance}`);
  }
  check(consistent, "every balance equals the sum of its movements", summary.join(" "));
}

// 23. Locks that protect the history
{
  const currency = await a.client.from("merchants").update({ currency: "USD" }).eq("id", m1Id).select();
  check(currency.error?.message === "currency_locked", "the currency cannot change after the first purchase", currency.error?.message ?? "allowed!");

  const rename = await a.client.from("merchants").update({ name: "Café de A" }).eq("id", m1Id).select("id");
  check(rename.data?.length === 1, "the name can still change", rowsOf(rename));

  const delBranch = await a.client.from("branches").delete().eq("id", branchId).select();
  check(delBranch.error?.code === "23503", "a branch with purchases cannot be deleted", delBranch.error?.code ?? rowsOf(delBranch));

  const renameBranch = await a.client.from("branches").update({ name: "Norte renombrada" }).eq("id", branchId).select("id");
  check(renameBranch.data?.length === 1, "a branch with purchases can be renamed", rowsOf(renameBranch));
}

// ---------------------------------------------------------------------------
// Module 6: rewards and redemption (runs while C is still staff of merchant 1)
// Balances here: D in merchant 1 = 6, D in merchant 2 = 630, A in merchant 2 = 25.
// ---------------------------------------------------------------------------
console.log("\n-- Module 6: rewards --");
const reward = (client, merchantId, name, cost, extra = {}) =>
  client.from("rewards").insert({ merchant_id: merchantId, name, points_cost: cost, ...extra }).select("id");
const redeem = (client, membershipId, rewardId, key = crypto.randomUUID()) =>
  client.rpc("redeem_reward", { p_membership_id: membershipId, p_reward_id: rewardId, p_idempotency_key: key });
let coffeeId;
let dessertId;
let capId;
let redemptionId;

// 24. Catalog
{
  const coffee = await reward(a.client, m1Id, "Café gratis", 5, { description: "Un café americano" });
  coffeeId = coffee.data?.[0]?.id;
  check(Boolean(coffeeId), "the owner creates a reward", coffee.error?.message);

  const dup = await reward(a.client, m1Id, "CAFÉ GRATIS", 9);
  check(dup.error?.code === "23505", "reward names are unique per merchant (any case)", dup.error?.code ?? "allowed!");

  for (const [label, cost] of [["0 points", 0], ["more than 1,000,000 points", 1000001]]) {
    const bad = await reward(a.client, m1Id, `Mala ${cost}`, cost);
    check(bad.error?.code === "23514", `the database rejects a cost of ${label}`, bad.error?.code ?? "allowed!");
  }

  const byStaff = await reward(c.client, m1Id, "Del cajero", 1);
  check(Boolean(byStaff.error), "staff cannot create rewards", byStaff.error?.code ?? "allowed!");

  const byOther = await reward(b.client, m1Id, "Ajena", 1);
  check(Boolean(byOther.error), "another owner cannot create rewards here", byOther.error?.code ?? "allowed!");

  const dessert = await reward(a.client, m1Id, "Postre", 3);
  dessertId = dessert.data?.[0]?.id;
  const off = await a.client.from("rewards").update({ is_active: false }).eq("id", dessertId).select("is_active");
  check(off.data?.[0]?.is_active === false, "the owner deactivates a reward", rowsOf(off));

  const cap = await reward(b.client, m2Id, "Gorra", 10);
  capId = cap.data?.[0]?.id;

  const staffRead = await c.client.from("rewards").select("id").eq("merchant_id", m1Id);
  check(staffRead.data?.length === 2, "staff see the whole catalog (active and inactive)", rowsOf(staffRead));

  const customerRead = await d.client.from("rewards").select("id").eq("merchant_id", m1Id);
  check(customerRead.data?.length === 1 && customerRead.data[0].id === coffeeId, "customers see only active rewards", rowsOf(customerRead));

  const otherRead = await b.client.from("rewards").select("id").eq("merchant_id", m1Id);
  check(otherRead.data?.length === 0, "another merchant cannot see the catalog", rowsOf(otherRead));

  const anonRead = await newClient().from("rewards").select("id");
  check(Boolean(anonRead.error) || anonRead.data.length === 0, "signed-out visitors cannot read the rewards table", rowsOf(anonRead));

  const pub = await newClient().rpc("get_public_rewards", { p_code: code1 });
  check(
    pub.data?.length === 1 && pub.data[0].name === "Café gratis" && Object.keys(pub.data[0]).length === 3,
    "the public list shows only active rewards (name, description, cost)",
    pub.error?.message ?? JSON.stringify(pub.data),
  );

  const staffUpd = await c.client.from("rewards").update({ points_cost: 1 }).eq("id", coffeeId).select();
  check(Boolean(staffUpd.error) || staffUpd.data.length === 0, "staff cannot edit rewards", rowsOf(staffUpd));

  const customerUpd = await d.client.from("rewards").update({ points_cost: 1 }).eq("id", coffeeId).select();
  check(Boolean(customerUpd.error) || customerUpd.data.length === 0, "customers cannot edit rewards", rowsOf(customerUpd));
}

// 25. Redemption
{
  const key = crypto.randomUUID();
  const first = await redeem(c.client, dIn1, coffeeId, key);
  redemptionId = first.data?.[0]?.transaction_id;
  check(first.data?.[0]?.spent_points === 5 && first.data?.[0]?.balance === 1, "staff redeem a reward and its cost is deducted", first.error?.message ?? JSON.stringify(first.data));

  const row = await a.client.from("point_transactions").select("type, points, reward_name").eq("id", redemptionId);
  check(row.data?.[0]?.type === "REDEEM" && row.data[0].points === -5 && row.data[0].reward_name === "Café gratis", "the redemption is a REDEEM movement with the reward name", JSON.stringify(row.data?.[0]));

  const replay = await redeem(c.client, dIn1, coffeeId, key);
  check(replay.data?.[0]?.transaction_id === redemptionId && replay.data?.[0]?.balance === 1, "the same idempotency key redeems only once", JSON.stringify(replay.data));

  const conflict = await redeem(c.client, dIn1, dessertId, key);
  check(conflict.error?.message === "idempotency_conflict", "reusing a key for another reward is rejected", conflict.error?.message ?? "allowed!");

  const broke = await redeem(c.client, dIn1, coffeeId);
  check(broke.error?.message === "insufficient_balance", "a redemption never leaves a negative balance", broke.error?.message ?? "allowed!");

  const inactive = await redeem(a.client, dIn1, dessertId);
  check(inactive.error?.message === "reward_not_available", "inactive rewards cannot be redeemed", inactive.error?.message ?? "allowed!");

  const foreignReward = await redeem(a.client, dIn1, capId);
  check(foreignReward.error?.message === "reward_not_available", "another merchant's reward cannot be redeemed here", foreignReward.error?.message ?? "allowed!");

  const self = await redeem(d.client, dIn1, coffeeId);
  check(self.error?.message === "not_allowed", "customers cannot redeem by themselves", self.error?.message ?? "allowed!");

  const other = await redeem(b.client, dIn1, coffeeId);
  check(other.error?.message === "not_allowed", "another merchant cannot redeem for these customers", other.error?.message ?? "allowed!");

  await b.client.from("loyalty_programs").update({ is_active: false }).eq("merchant_id", m2Id);
  const whilePaused = await redeem(b.client, dIn2, capId);
  check(whilePaused.data?.[0]?.spent_points === 10, "redeeming works while the program is paused", whilePaused.error?.message);
  await b.client.from("loyalty_programs").update({ is_active: true }).eq("merchant_id", m2Id);

  await a.client.from("rewards").update({ name: "Café americano gratis", points_cost: 7 }).eq("id", coffeeId);
  const old = await a.client.from("point_transactions").select("points, reward_name").eq("id", redemptionId);
  check(old.data?.[0]?.reward_name === "Café gratis" && old.data[0].points === -5, "past redemptions keep the name and cost they had", JSON.stringify(old.data?.[0]));

  const delUsed = await a.client.from("rewards").delete().eq("id", coffeeId).select();
  check(delUsed.error?.code === "23503", "a redeemed reward cannot be deleted", delUsed.error?.code ?? rowsOf(delUsed));

  const temp = await reward(a.client, m1Id, "Temporal", 1);
  const staffDel = await c.client.from("rewards").delete().eq("id", temp.data?.[0]?.id).select();
  check(Boolean(staffDel.error) || staffDel.data.length === 0, "staff cannot delete rewards", rowsOf(staffDel));
  const delNew = await a.client.from("rewards").delete().eq("id", temp.data?.[0]?.id).select("id");
  check(delNew.data?.length === 1, "a reward never redeemed can be deleted", rowsOf(delNew));
}

// 26. Reversing a redemption
{
  const byStaff = await c.client.rpc("reverse_transaction", { p_transaction_id: redemptionId, p_reason: "Error" });
  check(byStaff.error?.message === "not_allowed", "staff cannot reverse redemptions", byStaff.error?.message ?? "allowed!");

  const back = await a.client.rpc("reverse_transaction", { p_transaction_id: redemptionId, p_reason: "Canje equivocado" });
  check(back.data?.[0]?.reversed_points === 5 && back.data?.[0]?.balance === 6, "the owner reverses a redemption and the points come back", back.error?.message ?? JSON.stringify(back.data));

  const again = await a.client.rpc("reverse_transaction", { p_transaction_id: redemptionId, p_reason: "Otra vez" });
  check(again.error?.message === "already_reversed", "a redemption can be reversed only once", again.error?.message ?? "allowed!");

  let consistent = true;
  const summary = [];
  for (const [client, id] of [[a.client, dIn1], [b.client, dIn2], [b.client, aIn2]]) {
    const moves = await client.from("point_transactions").select("points").eq("membership_id", id);
    const sum = moves.data.reduce((total, t) => total + t.points, 0);
    const balance = await balanceOf(client, id);
    if (sum !== balance) consistent = false;
    summary.push(`${sum}/${balance}`);
  }
  check(consistent, "every balance still equals the sum of its movements", summary.join(" "));
}

// ===========================================================================
// Module 7 — customer codes (QR at the register)
// ===========================================================================
console.log("\n-- Module 7: customer codes --");
const e = await signUp("e", "Cliente E");
console.log(`info  created test user ${e.email}`);
const issue = async (client) => (await client.rpc("issue_customer_code")).data?.[0];
const resolve = (client, merchantId, code) =>
  client.rpc("resolve_customer_code", { p_merchant_id: merchantId, p_code: code });
const enroll = (client, merchantId, code) =>
  client.rpc("enroll_customer_by_code", { p_merchant_id: merchantId, p_code: code });

// 27. Issuing codes and the table nobody can touch
const dCode = await issue(d.client);
{
  const anonIssue = await newClient().rpc("issue_customer_code");
  check(Boolean(anonIssue.error), "anon cannot get a customer code", anonIssue.error?.code ?? "allowed!");

  check(/^[A-HJ-NP-Z2-9]{8}$/.test(dCode?.code ?? ""), "a code has 8 symbols without look-alikes", dCode?.code);
  const minutes = (new Date(dCode?.expires_at) - Date.now()) / 60000;
  check(dCode?.valid_seconds === 300 && minutes > 4.5 && minutes <= 5.1, "a code is valid for 5 minutes", `${dCode?.valid_seconds}s, ${minutes.toFixed(2)} min`);

  for (const [who, client] of [["the customer", d.client], ["the owner", a.client], ["anon", newClient()]]) {
    const read = await client.from("customer_codes").select("*");
    check(Boolean(read.error) || read.data.length === 0, `${who} cannot read customer_codes`, rowsOf(read));
  }
  const write = await d.client.from("customer_codes").insert({ user_id: d.id, code_hash: "x", expires_at: new Date().toISOString() });
  check(Boolean(write.error), "nobody can write customer_codes directly", write.error?.code ?? "allowed!");
}

// 28. Resolving a code at the register
const eCode = await issue(e.client);
const cCode = await issue(c.client);
{
  const byOwner = await resolve(a.client, m1Id, dCode.code);
  const row = byOwner.data?.[0];
  check(row?.status === "customer" && row.membership_id === dIn1 && row.full_name === "Cliente D", "the owner resolves a customer's code to their membership", byOwner.error?.message ?? JSON.stringify(row));

  const typed = `${dCode.code.slice(0, 4).toLowerCase()}-${dCode.code.slice(4).toLowerCase()}`;
  const byStaff = await resolve(c.client, m1Id, typed);
  check(byStaff.data?.[0]?.membership_id === dIn1, "staff resolve it too, typed in lowercase with a dash", byStaff.error?.message ?? JSON.stringify(byStaff.data?.[0]));

  const otherMerchant = await resolve(b.client, m2Id, dCode.code);
  check(otherMerchant.data?.[0]?.membership_id === dIn2, "the same code works at every merchant the person belongs to", JSON.stringify(otherMerchant.data?.[0]));

  const newcomer = await resolve(a.client, m1Id, eCode.code);
  const n = newcomer.data?.[0];
  check(n?.status === "not_customer" && n.full_name === "Cliente E" && n.membership_id === null, "a non-customer's code shows only their name", JSON.stringify(n));

  const colleague = await resolve(a.client, m1Id, cCode.code);
  check(colleague.data?.[0]?.status === "member", "a staff member's code is recognized as staff", JSON.stringify(colleague.data?.[0]));

  const unknown = await resolve(a.client, m1Id, "ABCDEFGH");
  const u = unknown.data?.[0];
  check(u?.status === "expired_or_unknown" && u.full_name === null && u.membership_id === null, "an unknown code reveals nothing", JSON.stringify(u));

  const byCustomer = await resolve(d.client, m1Id, eCode.code);
  check(byCustomer.error?.message === "not_allowed", "customers cannot resolve codes", byCustomer.error?.message ?? "allowed!");

  const foreign = await resolve(b.client, m1Id, dCode.code);
  check(foreign.error?.message === "not_allowed", "another merchant cannot resolve codes for this one", foreign.error?.message ?? "allowed!");

  const anonResolve = await resolve(newClient(), m1Id, dCode.code);
  check(Boolean(anonResolve.error), "anon cannot resolve codes", anonResolve.error?.code ?? "allowed!");

  const again = await resolve(a.client, m1Id, dCode.code);
  check(again.data?.[0]?.status === "customer", "a code can be used more than once while valid", JSON.stringify(again.data?.[0]));

  const renewed = await issue(d.client);
  const old = await resolve(a.client, m1Id, dCode.code);
  const fresh = await resolve(a.client, m1Id, renewed.code);
  check(old.data?.[0]?.status === "expired_or_unknown" && fresh.data?.[0]?.status === "customer", "a new code replaces the previous one", `${old.data?.[0]?.status} / ${fresh.data?.[0]?.status}`);
}

// 29. Enrolling from the register
{
  const byCustomer = await enroll(d.client, m1Id, eCode.code);
  check(byCustomer.error?.message === "not_allowed", "customers cannot enroll others", byCustomer.error?.message ?? "allowed!");

  const unknown = await enroll(a.client, m1Id, "ABCDEFGH");
  check(unknown.error?.message === "code_invalid", "an unknown code cannot be enrolled", unknown.error?.message ?? "allowed!");

  const colleague = await enroll(a.client, m1Id, cCode.code);
  check(colleague.error?.message === "merchant_member", "staff cannot be enrolled as customers", colleague.error?.message ?? "allowed!");

  await b.client.from("loyalty_programs").update({ is_active: false }).eq("merchant_id", m2Id);
  const paused = await enroll(b.client, m2Id, eCode.code);
  check(paused.error?.message === "program_not_active", "nobody is enrolled while the program is paused", paused.error?.message ?? "allowed!");
  await b.client.from("loyalty_programs").update({ is_active: true }).eq("merchant_id", m2Id);

  const byStaff = await enroll(c.client, m1Id, eCode.code);
  const eIn1 = await membershipOf(a.client, m1Id, e.id);
  check(!byStaff.error && byStaff.data === eIn1, "staff enroll a new customer with their code", byStaff.error?.message ?? `${byStaff.data} vs ${eIn1}`);

  const twice = await enroll(a.client, m1Id, eCode.code);
  check(twice.data === eIn1, "enrolling twice returns the same membership", twice.error?.message ?? twice.data);

  const now = await resolve(a.client, m1Id, eCode.code);
  check(now.data?.[0]?.status === "customer", "after enrolling, the code opens the customer", JSON.stringify(now.data?.[0]));

  const wallet = await e.client.from("memberships").select("merchant_id");
  check(wallet.data?.length === 1 && wallet.data[0].merchant_id === m1Id, "the new customer sees the merchant in their wallet", rowsOf(wallet));
}

// ===========================================================================
// Module 9 — merchant report
// ===========================================================================
console.log("\n-- Module 9: merchant report --");
const report = (client, merchantId, days = null) =>
  client.rpc("get_merchant_report", { p_merchant_id: merchantId, p_days: days });

// 30. Who can get the report
{
  for (const [who, client] of [["staff", c.client], ["a customer", d.client], ["another merchant's owner", b.client]]) {
    const r = await report(client, m1Id);
    check(r.error?.message === "not_allowed", `${who} cannot get the report`, r.error?.message ?? "allowed!");
  }
  const anon = await report(newClient(), m1Id);
  check(Boolean(anon.error), "anon cannot get the report", anon.error?.code ?? "allowed!");
  const bad = await report(a.client, m1Id, 15);
  check(bad.error?.message === "invalid_period", "only 7, 30, 90 days or everything are valid periods", bad.error?.message ?? "allowed!");
}

// 31. The figures match the ledger (recomputed here from the raw movements)
for (const [owner, merchantId, label] of [[a.client, m1Id, "Café de A"], [b.client, m2Id, "Tienda de B"]]) {
  const { data: moves } = await owner.from("point_transactions").select("id, type, points, purchase_amount_minor, membership_id, reference_id, reward_id, branch_id").eq("merchant_id", merchantId);
  const reversed = new Set(moves.filter((t) => t.type === "REVERSAL").map((t) => t.reference_id));
  const counted = moves.filter((t) => (t.type === "EARN" || t.type === "REDEEM") && !reversed.has(t.id));
  const earn = counted.filter((t) => t.type === "EARN");
  const redeem = counted.filter((t) => t.type === "REDEEM");
  const { data: members } = await owner.from("memberships").select("id, points_balance").eq("merchant_id", merchantId);

  const expected = {
    customers: { total: members.length, active: new Set(counted.map((t) => t.membership_id)).size },
    purchases: { count: earn.length, amount_minor: earn.reduce((n, t) => n + t.purchase_amount_minor, 0) },
    points: {
      earned: earn.reduce((n, t) => n + t.points, 0),
      redeemed: -redeem.reduce((n, t) => n + t.points, 0),
      in_circulation: members.reduce((n, m) => n + m.points_balance, 0),
    },
    redemptions: redeem.length,
  };
  const all = (await report(owner, merchantId)).data;
  const month = (await report(owner, merchantId, 30)).data;
  const got = {
    customers: { total: all?.customers.total, active: all?.customers.active },
    purchases: all?.purchases,
    points: all?.points,
    redemptions: all?.redemptions.count,
  };
  check(JSON.stringify(got) === JSON.stringify(expected), `${label}: every figure matches the ledger`, `got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
  check(JSON.stringify(month?.purchases) === JSON.stringify(all?.purchases), `${label}: the last 30 days include today's movements`, JSON.stringify(month?.purchases));
  check(all?.customers.new === members.length, `${label}: every customer joined in the period (new = total)`, `${all?.customers.new}`);

  const reversedEarns = moves.filter((t) => t.type === "EARN" && reversed.has(t.id)).length;
  const reversedRedeems = moves.filter((t) => t.type === "REDEEM" && reversed.has(t.id)).length;
  if (reversedEarns + reversedRedeems > 0)
    check(all?.purchases.count + all?.redemptions.count === moves.filter((t) => t.type !== "REVERSAL").length - reversedEarns - reversedRedeems,
      `${label}: reversed purchases and redemptions are left out`, `${reversedEarns} reversed purchases, ${reversedRedeems} reversed redemptions`);

  const topCount = all?.redemptions.top_rewards.reduce((n, r) => n + r.count, 0);
  check(topCount === Math.min(redeem.length, topCount) && (all?.redemptions.top_rewards.length ?? 0) <= 5, `${label}: top rewards add up and are at most 5`, JSON.stringify(all?.redemptions.top_rewards));
  const topCustomers = all?.top_customers ?? [];
  check(topCustomers.length <= 5 && topCustomers.every((x, i) => i === 0 || topCustomers[i - 1].amount_minor >= x.amount_minor), `${label}: best customers are sorted by amount (at most 5)`, JSON.stringify(topCustomers.map((x) => x.amount_minor)));
  if (all?.branches.length) {
    const byBranch = all.branches.reduce((n, x) => n + x.count, 0);
    check(byBranch === all.purchases.count, `${label}: purchases by branch add up to the total`, `${byBranch} vs ${all.purchases.count}`);
  }
}

// 32. A merchant without movements gets zeros, not errors
{
  const empty = await a.client.rpc("create_merchant", { p_name: "Vacío de A", p_currency: "USD" });
  const r = await report(a.client, empty.data, 7);
  check(!r.error && r.data.purchases.count === 0 && r.data.points.in_circulation === 0 && r.data.top_customers.length === 0 && r.data.branches.length === 0,
    "a merchant without movements gets an empty report", r.error?.message ?? JSON.stringify(r.data?.purchases));
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

  // (branchId has purchases since Module 5, so a fresh branch is used here.)
  const temp = await a.client.from("branches").insert({ merchant_id: m1Id, name: "Temporal" }).select("id");
  const delBranch = await a.client.from("branches").delete().eq("id", temp.data?.[0]?.id).select("id");
  check(delBranch.data?.length === 1, "owner can delete a branch without purchases", rowsOf(delBranch));

  const delMerchant = await a.client.from("merchants").delete().eq("id", m1Id).select();
  check(Boolean(delMerchant.error) || delMerchant.data.length === 0, "nobody can delete a merchant (out of scope)", rowsOf(delMerchant));
}

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
