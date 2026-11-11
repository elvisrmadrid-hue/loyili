import type { Metadata } from "next";
import { Suspense } from "react";
import { CURRENCY_OPTIONS, updateMerchant } from "@/modules/merchants";
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

  return (
    <>
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <section className={card}>
        <MerchantForm
          action={updateMerchant.bind(null, merchantId)}
          currencyOptions={CURRENCY_OPTIONS.map((c) => ({ value: c.code, label: c.label }))}
          defaultValues={{ name: membership.name, currency: membership.currency }}
          currencyHint="Puedes cambiarla mientras tu comercio no tenga compras registradas."
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
        />
      </section>
    </>
  );
}
