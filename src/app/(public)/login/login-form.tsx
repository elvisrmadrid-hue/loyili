"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/modules/auth";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type LoginFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next: string;
};

export function LoginForm({ action, next }: LoginFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <input type="hidden" name="next" value={next} />
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
        autoComplete="current-password"
        required
        errors={state?.fieldErrors?.password}
      />
      <Link href="/recuperar" className="-mt-2 self-end text-sm underline underline-offset-4">
        ¿Olvidaste tu contraseña?
      </Link>
      <SubmitButton pendingText="Entrando…">Iniciar sesión</SubmitButton>
    </form>
  );
}
