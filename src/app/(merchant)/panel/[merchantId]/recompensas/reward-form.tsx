"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type RewardFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: { name: string; description: string; pointsCost: string };
  submitLabel: string;
  /** Keeps field ids unique when several forms are on the page. */
  idPrefix: string;
  maxCost: number;
};

/** Name, cost and optional description of a reward (create and edit). */
export function RewardForm({ action, defaultValues, submitLabel, idPrefix, maxCost }: RewardFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <TextField
          id={`${idPrefix}-name`}
          label="Nombre"
          name="name"
          required
          maxLength={80}
          placeholder="Ej.: Café gratis"
          defaultValue={values?.name}
          errors={state?.fieldErrors?.name}
        />
        <TextField
          id={`${idPrefix}-cost`}
          label="Costo en puntos"
          name="pointsCost"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxCost}
          step={1}
          required
          defaultValue={values?.pointsCost}
          errors={state?.fieldErrors?.pointsCost}
        />
      </div>
      <TextField
        id={`${idPrefix}-description`}
        label="Descripción (opcional)"
        name="description"
        maxLength={200}
        placeholder="Ej.: Un café americano o con leche, del tamaño que quieras"
        defaultValue={values?.description}
        errors={state?.fieldErrors?.description}
      />
      <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
    </form>
  );
}
