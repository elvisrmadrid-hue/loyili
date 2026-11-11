"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type BranchFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: { name: string; address: string };
  submitLabel: string;
  /** Distinguishes field ids when several forms are on the same page. */
  idPrefix: string;
};

/** Name + address form, used to create and to edit a branch. */
export function BranchForm({ action, defaultValues, submitLabel, idPrefix }: BranchFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <TextField
        id={`${idPrefix}-name`}
        label="Nombre"
        name="name"
        required
        maxLength={100}
        placeholder="Ej.: Centro"
        defaultValue={values?.name}
        errors={state?.fieldErrors?.name}
      />
      <TextField
        id={`${idPrefix}-address`}
        label="Dirección (opcional)"
        name="address"
        maxLength={200}
        defaultValue={values?.address}
        errors={state?.fieldErrors?.address}
      />
      <SubmitButton pendingText="Guardando…" variant="secondary">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
