import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currencyLabel, getBranches } from "@/modules/merchants";
import { getCustomerCount } from "@/modules/customers";
import { describeRule, getLoyaltyProgram } from "@/modules/loyalty";
import { Loading } from "@/components/ui/loading";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "./load-membership";
import { ProgramStatus } from "@/components/ui/program-status";

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
  const [branches, program, customerCount] = await Promise.all([
    getBranches(merchantId),
    getLoyaltyProgram(merchantId),
    getCustomerCount(merchantId),
  ]);
  const isOwner = membership.role === "owner";
  const base = `/panel/${merchantId}`;

  return (
    <>
      <h1 className="text-2xl font-semibold">Inicio</h1>

      <dl className={`${card} grid grid-cols-2 gap-3 sm:grid-cols-4`}>
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
        <div>
          <dt className={mutedText}>Clientes</dt>
          <dd className="font-medium">{customerCount}</dd>
        </div>
      </dl>

      <Link href={`${base}/programa`} className={`${card} flex flex-col gap-1 hover:border-foreground`}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Programa de puntos</p>
          {program && <ProgramStatus active={program.isActive} />}
        </div>
        <p className={mutedText}>
          {program
            ? `Tus clientes ganan ${describeRule(program, membership.currency)} gastados.`
            : isOwner
              ? "Configura tu programa: define cuántos puntos gana un cliente según lo que gasta."
              : "El dueño aún no ha configurado el programa de puntos."}
        </p>
      </Link>

      {isOwner ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href={`${base}/clientes`} className={`${card} hover:border-foreground`}>
            <p className="font-medium">Clientes</p>
            <p className={mutedText}>Invítalos con tu enlace o un cartel con QR.</p>
          </Link>
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
        Próximamente: registro de compras y recompensas.
      </p>
    </>
  );
}
