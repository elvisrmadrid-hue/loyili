import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { getMembership } from "@/modules/merchants";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";
import { MerchantNav } from "./merchant-nav";

/**
 * Shell of every page of one merchant: header, merchant name and section menu.
 * Non-members get a 404, so nobody can tell whether a merchant exists.
 */
export default function MerchantLayout({ children, params }: LayoutProps<"/panel/[merchantId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <MerchantShell params={params}>{children}</MerchantShell>
    </Suspense>
  );
}

async function MerchantShell({
  children,
  params,
}: Pick<LayoutProps<"/panel/[merchantId]">, "children" | "params">) {
  const { merchantId } = await params;
  const user = await requireUser(`/panel/${merchantId}`);
  const [profile, membership] = await Promise.all([getCurrentProfile(), getMembership(merchantId)]);
  if (!membership) notFound();

  const name = profile?.fullName ?? user.email ?? "Usuario";

  return (
    <>
      <AppHeader userName={name} signOutAction={signOut} />
      <div className="border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 pt-4">
          <p className="truncate text-lg font-semibold">{membership.name}</p>
          <MerchantNav merchantId={membership.id} isOwner={membership.role === "owner"} />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </>
  );
}
