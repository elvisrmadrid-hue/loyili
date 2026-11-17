import type { Metadata } from "next";
import { Suspense } from "react";
import { CURRENCY_OPTIONS, updateMerchant } from "@/modules/merchants";
import { merchantHasTransactions } from "@/modules/ledger";
import { Loading } from "@/components/ui/loading";
import { card } from "@/components/ui/styles";
import { MerchantForm } from "../../_components/merchant-form";
import { loadMembership } from "../load-membership";

export const metadata: Metadata = { title: "Ajustes del comercio" };

export default function SettingsPage({ params }: PageProps<"/panel/[merchantId]/ajustes">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Settings merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Settings({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId, { ownerOnly: true });
  const currencyLocked = await merchantHasTransactions(merchantId);

  return (
    <>
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <section className={card}>
        <MerchantForm
          action={updateMerchant.bind(null, merchantId)}
          currencyOptions={CURRENCY_OPTIONS.map((c) => ({ value: c.code, label: c.label }))}
          defaultValues={{ name: membership.name, currency: membership.currency }}
          currencyHint={
            currencyLocked
              ? "La moneda ya no se puede cambiar porque tu comercio tiene compras registradas: cambiarla alteraría el significado de los montos guardados."
              : "Puedes cambiarla mientras tu comercio no tenga compras registradas. Si la cambias, tu programa de puntos se pausará para que revises la regla."
          }
          currencyLocked={currencyLocked}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
        />
      </section>
    </>
  );
}
