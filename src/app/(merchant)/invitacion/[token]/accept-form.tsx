"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";

type AcceptFormProps = {
  action: (state: FormState) => Promise<FormState>;
};

export function AcceptForm({ action }: AcceptFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert error={state?.error} />
      <SubmitButton pendingText="Uniéndote…">Aceptar invitación</SubmitButton>
    </form>
  );
}
