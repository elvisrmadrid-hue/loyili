import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/modules/auth";

const primaryButton = "rounded-full bg-foreground px-6 py-3 font-medium text-background";
const secondaryButton = "rounded-full border border-zinc-300 px-6 py-3 font-medium dark:border-zinc-700";
const navClass = "flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Loyili</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Fidelización digital para negocios: puntos y recompensas sin tarjetas físicas.
      </p>
      {/* Static text above loads instantly; the buttons depend on the session. */}
      <Suspense fallback={<div className={`${navClass} h-[7.5rem] sm:h-12`} aria-hidden />}>
        <HomeActions />
      </Suspense>
    </main>
  );
}

async function HomeActions() {
  const user = await getCurrentUser();

  return (
    <nav className={navClass}>
      {user ? (
        <>
          <Link href="/wallet" className={primaryButton}>
            Ir a mi billetera
          </Link>
          <Link href="/panel" className={secondaryButton}>
            Panel del comercio
          </Link>
        </>
      ) : (
        <>
          <Link href="/login" className={primaryButton}>
            Iniciar sesión
          </Link>
          <Link href="/registro" className={secondaryButton}>
            Crear cuenta
          </Link>
        </>
      )}
    </nav>
  );
}
