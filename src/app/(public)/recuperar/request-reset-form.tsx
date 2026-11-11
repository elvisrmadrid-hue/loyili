"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/modules/auth";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type RequestResetFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  initialError?: string;
};

export function RequestResetForm({ action, initialError }: RequestResetFormProps) {
  const [state, formAction] = useActionState(action, initialError ? { error: initialError } : undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state?.values?.email}
        errors={state?.fieldErrors?.email}
      />
      <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
