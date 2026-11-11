import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { currencyLabel, getMyMerchants } from "@/modules/merchants";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";
import { card, mutedText, primaryButton, secondaryButton } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Mis comercios" };

const ROLE_LABEL = { owner: "Dueño", staff: "Personal" } as const;

export default function MerchantListPage() {
  // The session is read at request time, so it lives behind a Suspense boundary (Cache Components).
  return (
    <Suspense fallback={<Loading />}>
      <MerchantList />
    </Suspense>
  );
}

async function MerchantList() {
  const user = await requireUser("/panel");
  const [profile, merchants] = await Promise.all([getCurrentProfile(), getMyMerchants()]);
  const name = profile?.fullName ?? user.email ?? "Usuario";

  return (
    <>
      <AppHeader userName={name} signOutAction={signOut} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Mis comercios</h1>
          <p className={mutedText}>
            <Link href="/wallet" className="underline underline-offset-4">
              Ir a mi billetera
            </Link>
          </p>
        </div>

        {merchants.length === 0 ? (
          <div className={`${card} flex flex-col items-start gap-3`}>
            <h2 className="text-lg font-semibold">Todavía no tienes un comercio</h2>
            <p className={mutedText}>
              Crea tu comercio para empezar tu programa de puntos. Si te invitaron como personal de
              un comercio, abre el enlace de invitación que te enviaron.
            </p>
            <Link href="/panel/nuevo" className={primaryButton}>
              Crear mi comercio
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {merchants.map((merchant) => (
                <li key={merchant.id}>
                  <Link
                    href={`/panel/${merchant.id}`}
                    className={`${card} flex items-center justify-between gap-4 hover:border-foreground`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{merchant.name}</p>
                      <p className={mutedText}>{currencyLabel(merchant.currency)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
                      {ROLE_LABEL[merchant.role]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/panel/nuevo" className={`${secondaryButton} self-start`}>
              Crear otro comercio
            </Link>
          </>
        )}
      </main>
    </>
  );
}
