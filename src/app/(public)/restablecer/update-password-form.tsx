"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/modules/auth";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type UpdatePasswordFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  passwordMinLength: number;
};

export function UpdatePasswordForm({ action, passwordMinLength }: UpdatePasswordFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <TextField
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={passwordMinLength}
        placeholder={`Mínimo ${passwordMinLength} caracteres`}
        errors={state?.fieldErrors?.password}
      />
      <TextField
        label="Repite la contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
