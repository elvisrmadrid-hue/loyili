import type { Metadata } from "next";
import { Suspense } from "react";
import {
  describeRule,
  fromMinorUnits,
  getLoyaltyProgram,
  saveLoyaltyProgram,
  setLoyaltyProgramActive,
} from "@/modules/loyalty";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Loading } from "@/components/ui/loading";
import { SubmitButton } from "@/components/ui/submit-button";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";
import { ProgramStatus } from "./program-status";
import { ProgramForm } from "./program-form";

export const metadata: Metadata = { title: "Programa de puntos" };

export default function ProgramPage({ params }: PageProps<"/panel/[merchantId]/programa">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Program merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Program({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId);
  const program = await getLoyaltyProgram(merchantId);
  const isOwner = membership.role === "owner";
  const currency = membership.currency;

  return (
    <>
      <h1 className="text-2xl font-semibold">Programa de puntos</h1>

      {program ? (
        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Regla actual</h2>
            <ProgramStatus active={program.isActive} />
          </div>
          <p className="text-lg">
            Tus clientes ganan <strong>{describeRule(program, currency)}</strong> gastados.
          </p>
          {!program.isActive && (
            <p className={mutedText}>
              Mientras esté pausado no se darán puntos. Los puntos que ya tienen tus clientes se
              conservan.
            </p>
          )}
          {isOwner && (
            <div className="flex justify-end">
              {program.isActive ? (
                <ConfirmActionButton
                  action={setLoyaltyProgramActive.bind(null, merchantId, false)}
                  confirmMessage="¿Pausar el programa? Mientras esté pausado no se darán puntos. La regla y los puntos de tus clientes se conservan."
                  label="Pausar programa"
                  pendingLabel="Pausando…"
                />
              ) : (
                <form action={setLoyaltyProgramActive.bind(null, merchantId, true)}>
                  <SubmitButton variant="secondary" pendingText="Reanudando…">
                    Reanudar programa
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </section>
      ) : (
        !isOwner && (
          <p className={card}>El dueño del comercio aún no ha configurado el programa de puntos.</p>
        )
      )}

      {isOwner && (
        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">{program ? "Cambiar la regla" : "Crea tu programa"}</h2>
            <p className={mutedText}>
              {program
                ? "Los cambios solo se aplican a las compras futuras. Los puntos que tus clientes ya ganaron no cambian."
                : "Define cuántos puntos gana un cliente según lo que gasta. Por ejemplo: 1 punto por cada 1.000. Podrás cambiarlo cuando quieras."}
            </p>
          </div>
          <ProgramForm
            action={saveLoyaltyProgram.bind(null, merchantId)}
            currency={currency}
            defaultValues={
              program
                ? {
                    pointsPerBlock: String(program.pointsPerBlock),
                    blockAmount: String(fromMinorUnits(program.blockAmountMinor, currency)),
                  }
                : { pointsPerBlock: "1", blockAmount: "" }
            }
            submitLabel={program ? "Guardar regla" : "Crear programa"}
            pendingLabel="Guardando…"
          />
        </section>
      )}
    </>
  );
}
