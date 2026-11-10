import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Loyili</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Fidelización digital para negocios: puntos y recompensas sin tarjetas
        físicas.
      </p>
      <nav className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/wallet"
          className="rounded-full bg-foreground px-6 py-3 font-medium text-background"
        >
          Soy cliente
        </Link>
        <Link
          href="/panel"
          className="rounded-full border border-zinc-300 px-6 py-3 font-medium dark:border-zinc-700"
        >
          Soy comercio
        </Link>
      </nav>
      <p className="text-sm text-zinc-500">
        Módulo 0 · entorno inicial
      </p>
    </main>
  );
}
