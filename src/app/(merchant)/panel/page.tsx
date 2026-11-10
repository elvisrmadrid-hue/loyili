import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panel del comercio" };

export default function MerchantPanelPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">Panel del comercio</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Aquí el comercio gestionará su programa, clientes y recompensas.
        (Se construye a partir del Módulo 2).
      </p>
    </main>
  );
}
