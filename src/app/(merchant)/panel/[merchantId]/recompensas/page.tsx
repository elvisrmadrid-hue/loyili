import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPoints } from "@/modules/loyalty";
import {
  createReward,
  deleteReward,
  getRewards,
  REWARD_COST_MAX,
  setRewardActive,
  updateReward,
} from "@/modules/rewards";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Loading } from "@/components/ui/loading";
import { SubmitButton } from "@/components/ui/submit-button";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";
import { RewardForm } from "./reward-form";

export const metadata: Metadata = { title: "Recompensas" };

export default function RewardsPage({ params }: PageProps<"/panel/[merchantId]/recompensas">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Rewards merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Rewards({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId);
  const rewards = await getRewards(merchantId);
  const isOwner = membership.role === "owner";
  const { currency } = membership;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Recompensas</h1>
        <p className={mutedText}>
          Lo que tus clientes pueden conseguir con sus puntos. Se canjean en «Caja».
        </p>
      </div>

      {rewards.length === 0 ? (
        <p className={mutedText}>
          {isOwner ? "Aún no tienes recompensas. Crea la primera aquí abajo." : "El dueño aún no ha creado recompensas."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rewards.map((reward) => (
            <li key={reward.id} className={`${card} flex flex-col gap-2 ${reward.isActive ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {reward.name}
                    {!reward.isActive && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Inactiva
                      </span>
                    )}
                  </p>
                  <p className={mutedText}>{formatPoints(reward.pointsCost, currency)}</p>
                  {reward.description && <p className={mutedText}>{reward.description}</p>}
                </div>
                {isOwner && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <form action={setRewardActive.bind(null, merchantId, reward.id, !reward.isActive)}>
                      <SubmitButton variant="secondary" pendingText="…">
                        {reward.isActive ? "Desactivar" : "Activar"}
                      </SubmitButton>
                    </form>
                    {!reward.hasRedemptions && (
                      <ConfirmActionButton
                        action={deleteReward.bind(null, merchantId, reward.id)}
                        confirmMessage={`¿Eliminar la recompensa «${reward.name}»?`}
                        label="Eliminar"
                        pendingLabel="Eliminando…"
                      />
                    )}
                  </div>
                )}
              </div>
              {isOwner && reward.hasRedemptions && (
                <p className={mutedText}>Ya se ha canjeado: no se puede eliminar, pero sí desactivar.</p>
              )}
              {isOwner && (
                <details>
                  <summary className="cursor-pointer text-sm underline underline-offset-4">Editar</summary>
                  <div className="pt-3">
                    <RewardForm
                      action={updateReward.bind(null, merchantId, reward.id)}
                      defaultValues={{
                        name: reward.name,
                        description: reward.description ?? "",
                        pointsCost: String(reward.pointsCost),
                      }}
                      submitLabel="Guardar cambios"
                      idPrefix={`reward-${reward.id}`}
                      maxCost={REWARD_COST_MAX}
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
          <h2 className="font-semibold">Añadir recompensa</h2>
          <RewardForm
            action={createReward.bind(null, merchantId)}
            submitLabel="Añadir recompensa"
            idPrefix="new-reward"
            maxCost={REWARD_COST_MAX}
          />
        </section>
      )}
    </>
  );
}
