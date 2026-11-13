"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms";
import { formatWholeAmount } from "@/lib/currencies";
import {
  BLOCK_AMOUNT_MAX,
  POINTS_PER_BLOCK_MAX,
  POINTS_PER_BLOCK_MIN,
  calculatePoints,
  describeRule,
  formatPoints,
  parseWholeAmount,
  toMinorUnits,
} from "@/modules/loyalty/rules";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { mutedText } from "@/components/ui/styles";

type ProgramFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  currency: string;
  defaultValues: { pointsPerBlock: string; blockAmount: string };
  submitLabel: string;
  pendingLabel: string;
};

/** Reads the typed rule; null while it is incomplete or out of range. */
function ruleFrom(pointsText: string, amountText: string, currency: string) {
  const points = /^\d+$/.test(pointsText.trim()) ? Number(pointsText) : null;
  const units = parseWholeAmount(amountText);
  if (points === null || points < POINTS_PER_BLOCK_MIN || points > POINTS_PER_BLOCK_MAX) return null;
  if (units === null || units < 1 || units > BLOCK_AMOUNT_MAX) return null;
  return { pointsPerBlock: points, blockAmountMinor: toMinorUnits(units, currency) };
}

/** Earning-rule form with a live preview and an example calculator. */
export function ProgramForm({ action, currency, defaultValues, submitLabel, pendingLabel }: ProgramFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const [points, setPoints] = useState(defaultValues.pointsPerBlock);
  const [amount, setAmount] = useState(defaultValues.blockAmount);
  const [example, setExample] = useState("");

  const rule = ruleFrom(points, amount, currency);
  const exampleUnits = parseWholeAmount(example);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Puntos que gana el cliente"
          name="pointsPerBlock"
          type="number"
          inputMode="numeric"
          min={POINTS_PER_BLOCK_MIN}
          max={POINTS_PER_BLOCK_MAX}
          step={1}
          required
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          errors={state?.fieldErrors?.pointsPerBlock}
        />
        <TextField
          label={`Por cada (monto en ${currency}, sin decimales)`}
          name="blockAmount"
          inputMode="numeric"
          placeholder="Ej.: 1.000"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          errors={state?.fieldErrors?.blockAmount}
        />
      </div>

      <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900" aria-live="polite">
        {rule ? (
          <>
            Tus clientes ganarán <strong>{describeRule(rule, currency)}</strong> gastados. Se cuentan
            solo los montos completos.
          </>
        ) : (
          "Completa los dos campos para ver cómo queda la regla."
        )}
      </p>

      <div className="flex flex-col gap-2">
        <TextField
          label="Prueba con una compra de ejemplo"
          name="example"
          inputMode="numeric"
          placeholder="Ej.: 2.700"
          value={example}
          onChange={(event) => setExample(event.target.value)}
        />
        <p className={mutedText} aria-live="polite">
          {!rule || example.trim() === ""
            ? "Escribe un monto para ver cuántos puntos daría."
            : exampleUnits === null
              ? "Escribe un monto entero, sin decimales."
              : `Una compra de ${formatWholeAmount(exampleUnits, currency)} da ${formatPoints(
                  calculatePoints(toMinorUnits(exampleUnits, currency), rule),
                  currency,
                )}.`}
        </p>
      </div>

      <SubmitButton pendingText={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
