import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { issueMyCode } from "@/modules/identification";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";
import { CustomerCode } from "./customer-code";

export const metadata: Metadata = { title: "Mi código" };

export default function MyCodePage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyCode />
    </Suspense>
  );
}

async function MyCode() {
  const user = await requireUser("/wallet/codigo");
  const profile = await getCurrentProfile();

  return (
    <>
      <AppHeader userName={profile?.fullName ?? user.email ?? "Usuario"} signOutAction={signOut} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
        <Link href="/wallet" className="text-sm underline underline-offset-4">
          ← Mis programas
        </Link>
        <h1 className="text-2xl font-semibold">Mi código</h1>
        {/* The code itself is requested by the browser each time this screen appears. */}
        <CustomerCode issueAction={issueMyCode} />
        <noscript>
          <p>Para ver tu código necesitas tener JavaScript activado en el navegador.</p>
        </noscript>
      </main>
    </>
  );
}
