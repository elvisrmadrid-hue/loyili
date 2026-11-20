import type { Metadata } from "next";
import { Suspense } from "react";
import { createBranch, deleteBranch, getBranches, updateBranch } from "@/modules/merchants";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Loading } from "@/components/ui/loading";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";
import { BranchForm } from "./branch-form";

export const metadata: Metadata = { title: "Sucursales" };

export default function BranchesPage({ params }: PageProps<"/panel/[merchantId]/sucursales">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Branches merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Branches({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId);
  const branches = await getBranches(merchantId);
  const isOwner = membership.role === "owner";

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sucursales</h1>
        <p className={mutedText}>
          Son opcionales. Sirven para saber en qué local se hizo cada compra.
        </p>
      </div>

      {branches.length === 0 ? (
        <p className={mutedText}>Este comercio todavía no tiene sucursales.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {branches.map((branch) => (
            <li key={branch.id} className={`${card} flex flex-col gap-2`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{branch.name}</p>
                  {branch.address && <p className={mutedText}>{branch.address}</p>}
                  {isOwner && branch.hasPurchases && (
                    <p className={mutedText}>
                      Tiene compras registradas: no se puede eliminar, pero sí cambiarle el nombre.
                    </p>
                  )}
                </div>
                {isOwner && !branch.hasPurchases && (
                  <ConfirmActionButton
                    action={deleteBranch.bind(null, merchantId, branch.id)}
                    confirmMessage={`¿Eliminar la sucursal «${branch.name}»?`}
                    label="Eliminar"
                    pendingLabel="Eliminando…"
                  />
                )}
              </div>
              {isOwner && (
                <details>
                  <summary className="cursor-pointer py-2 text-sm underline underline-offset-4">Editar</summary>
                  <div className="pt-3">
                    <BranchForm
                      action={updateBranch.bind(null, merchantId, branch.id)}
                      defaultValues={{ name: branch.name, address: branch.address ?? "" }}
                      submitLabel="Guardar cambios"
                      idPrefix={`branch-${branch.id}`}
                    />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold">Añadir sucursal</h2>
          <BranchForm action={createBranch.bind(null, merchantId)} submitLabel="Añadir sucursal" idPrefix="new-branch" />
        </section>
      )}
    </>
  );
}
