import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currencyLabel, getBranches } from "@/modules/merchants";
import { Loading } from "@/components/ui/loading";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "./load-membership";

export const metadata: Metadata = { title: "Mi comercio" };

export default function MerchantHomePage({ params }: PageProps<"/panel/[merchantId]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <MerchantHome merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function MerchantHome({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId);
  const branches = await getBranches(merchantId);
  const isOwner = membership.role === "owner";
  const base = `/panel/${merchantId}`;

  return (
    <>
      <h1 className="text-2xl font-semibold">Inicio</h1>

      <dl className={`${card} grid gap-3 sm:grid-cols-3`}>
        <div>
          <dt className={mutedText}>Tu rol</dt>
          <dd className="font-medium">{isOwner ? "Dueño" : "Personal"}</dd>
        </div>
        <div>
          <dt className={mutedText}>Moneda</dt>
          <dd className="font-medium">{currencyLabel(membership.currency)}</dd>
        </div>
        <div>
          <dt className={mutedText}>Sucursales</dt>
          <dd className="font-medium">{branches.length}</dd>
        </div>
      </dl>

      {isOwner ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`${base}/sucursales`} className={`${card} hover:border-foreground`}>
            <p className="font-medium">Sucursales</p>
            <p className={mutedText}>Registra los locales de tu negocio (opcional).</p>
          </Link>
          <Link href={`${base}/personal`} className={`${card} hover:border-foreground`}>
            <p className="font-medium">Personal</p>
            <p className={mutedText}>Invita a tus cajeros con un enlace.</p>
          </Link>
        </div>
      ) : (
        <p className={mutedText}>
          Eres parte del personal de este comercio. Desde aquí registrarás compras y canjes cuando
          esas funciones estén disponibles.
        </p>
      )}

      <p className={mutedText}>
        Próximamente: programa de puntos, clientes y recompensas.
      </p>
    </>
  );
}
