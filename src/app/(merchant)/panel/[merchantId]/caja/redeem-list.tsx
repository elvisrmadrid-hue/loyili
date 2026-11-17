"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { formatPoints } from "@/modules/loyalty/rules";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { mutedText } from "@/components/ui/styles";

type RedeemListProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  membershipId: string;
  customerName: string;
  balance: number;
  currency: string;
  rewards: { id: string; name: string; description: string | null; pointsCost: number }[];
  /** New for every page render: the same redemption sent twice is recorded once. */
  idempotencyKey: string;
};

/** Active rewards for the selected customer, with "Canjear" when the balance is enough. */
export function RedeemList({ action, membershipId, customerName, balance, currency, rewards, idempotencyKey }: RedeemListProps) {
  // One shared state for the whole list: the last redemption's result.
  const [state, formAction] = useActionState(action, undefined);

  return (
    <div className="flex flex-col gap-3">
      <FormAlert error={state?.error} message={state?.message} />
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {rewards.map((reward) => {
          const missing = reward.pointsCost - balance;
          return (
            <li key={reward.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{reward.name}</p>
                <p className={mutedText}>
                  {formatPoints(reward.pointsCost, currency)}
                  {reward.description && ` · ${reward.description}`}
                </p>
              </div>
              {missing > 0 ? (
                <p className={`${mutedText} shrink-0 text-right`}>Le faltan {formatPoints(missing, currency)}</p>
              ) : (
                <form
                  action={formAction}
                  onSubmit={(event) => {
                    const question = `¿Canjear «${reward.name}» por ${formatPoints(reward.pointsCost, currency)} para ${customerName}?`;
                    if (!window.confirm(question)) event.preventDefault();
                  }}
                  className="shrink-0"
                >
                  <input type="hidden" name="membershipId" value={membershipId} />
                  <input type="hidden" name="rewardId" value={reward.id} />
                  <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
                  <SubmitButton variant="secondary" pendingText="Canjeando…">
                    Canjear
                  </SubmitButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
