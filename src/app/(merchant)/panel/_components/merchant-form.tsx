"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type MerchantFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  currencyOptions: { value: string; label: string }[];
  defaultValues?: { name: string; currency: string };
  submitLabel: string;
  pendingLabel: string;
  /** Extra explanation under the currency field. */
  currencyHint?: string;
};

/** Name + currency form, used to create a merchant and to edit its settings. */
export function MerchantForm({
  action,
  currencyOptions,
  defaultValues,
  submitLabel,
  pendingLabel,
  currencyHint,
}: MerchantFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const values = state?.values ?? defaultValues;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <TextField
        label="Nombre del comercio"
        name="name"
        required
        maxLength={100}
        defaultValue={values?.name}
        errors={state?.fieldErrors?.name}
      />
      <div className="flex flex-col gap-1.5">
        <SelectField
          label="Moneda"
          name="currency"
          required
          options={currencyOptions}
          placeholder="Elige la moneda"
          defaultValue={values?.currency ?? ""}
          errors={state?.fieldErrors?.currency}
        />
        {currencyHint && <p className="text-sm text-zinc-600 dark:text-zinc-400">{currencyHint}</p>}
      </div>
      <SubmitButton pendingText={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
