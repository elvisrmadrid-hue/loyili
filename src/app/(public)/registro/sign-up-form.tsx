"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/modules/auth";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type SignUpFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  passwordMinLength: number;
};

export function SignUpForm({ action, passwordMinLength }: SignUpFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <TextField
        label="Nombre"
        name="fullName"
        type="text"
        autoComplete="name"
        required
        maxLength={100}
        defaultValue={state?.values?.fullName}
        errors={state?.fieldErrors?.fullName}
      />
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
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={passwordMinLength}
        placeholder={`Mínimo ${passwordMinLength} caracteres`}
        errors={state?.fieldErrors?.password}
      />
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
