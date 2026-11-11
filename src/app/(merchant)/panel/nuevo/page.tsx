import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { CURRENCY_OPTIONS, createMerchant } from "@/modules/merchants";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";
import { mutedText } from "@/components/ui/styles";
import { MerchantForm } from "../_components/merchant-form";

export const metadata: Metadata = { title: "Crear comercio" };

export default function NewMerchantPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewMerchant />
    </Suspense>
  );
}

async function NewMerchant() {
  const user = await requireUser("/panel/nuevo");
  const profile = await getCurrentProfile();
  const name = profile?.fullName ?? user.email ?? "Usuario";

  return (
    <>
      <AppHeader userName={name} signOutAction={signOut} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-1">
          <Link href="/panel" className={`${mutedText} underline underline-offset-4`}>
            ← Mis comercios
          </Link>
          <h1 className="text-2xl font-semibold">Crear comercio</h1>
          <p className={mutedText}>
            Serás el dueño. Después podrás añadir sucursales e invitar a tu personal.
          </p>
        </div>
        <MerchantForm
          action={createMerchant}
          currencyOptions={CURRENCY_OPTIONS.map((c) => ({ value: c.code, label: c.label }))}
          currencyHint="Se usará para calcular los puntos según el monto de cada compra."
          submitLabel="Crear comercio"
          pendingLabel="Creando…"
        />
      </main>
    </>
  );
}
