"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type ReverseFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** "compra de $ 25.500 (+25 puntos)": what is being cancelled. */
  summary: string;
  /** "compra" or "canje". */
  kind: "compra" | "canje";
  idPrefix: string;
};

/** Owner-only: cancels a purchase with a reason. Nothing is deleted; a reversal is added. */
export function ReverseForm({ action, summary, kind, idPrefix }: ReverseFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <details className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <summary className="cursor-pointer text-sm font-medium text-red-600 dark:text-red-400">Anular {kind}</summary>
      <form action={formAction} className="flex flex-col gap-3 pt-3" noValidate>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {kind === "compra"
            ? `Se descontarán los puntos de esta compra: ${summary}.`
            : `Se devolverán al cliente los puntos de este canje: ${summary}.`}{" "}
          El movimiento queda en el historial marcado como anulado; no se puede deshacer.
        </p>
        <FormAlert error={state?.error} message={state?.message} />
        <TextField
          id={`${idPrefix}-reason`}
          label="Motivo"
          name="reason"
          required
          minLength={3}
          maxLength={200}
          placeholder="Ej.: monto equivocado"
          defaultValue={state?.values?.reason}
          errors={state?.fieldErrors?.reason}
        />
        <SubmitButton pendingText="Anulando…">Confirmar anulación</SubmitButton>
      </form>
    </details>
  );
}
