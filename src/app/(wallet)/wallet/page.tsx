import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";

export const metadata: Metadata = { title: "Mi billetera" };

export default function WalletPage() {
  // The session is read at request time, so it lives behind a Suspense boundary (Cache Components).
  return (
    <Suspense fallback={<Loading />}>
      <WalletContent />
    </Suspense>
  );
}

async function WalletContent() {
  const user = await requireUser("/wallet");
  const profile = await getCurrentProfile();
  const name = profile?.fullName ?? user.email ?? "Usuario";

  return (
    <>
      <AppHeader userName={name} signOutAction={signOut} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold sm:text-3xl">Hola, {name}</h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Esta es tu billetera. Aquí verás tus puntos, movimientos y recompensas en cada comercio.
          (Se construye a partir del Módulo 4).
        </p>
        <Link href="/panel" className="text-sm underline underline-offset-4">
          Ir al panel de mi comercio
        </Link>
      </main>
    </>
  );
}
