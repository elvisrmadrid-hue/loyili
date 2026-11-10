import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi billetera" };

export default function WalletPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">Mi billetera</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Aquí el cliente verá sus puntos, movimientos y recompensas.
        (Se construye a partir del Módulo 4).
      </p>
    </main>
  );
}
