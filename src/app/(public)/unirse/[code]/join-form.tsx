"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";

type JoinFormProps = {
  action: (state: FormState) => Promise<FormState>;
};

/** "Join" button: enrolls the signed-in user in the merchant's program. */
export function JoinForm({ action }: JoinFormProps) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert error={state?.error} />
      <SubmitButton pendingText="Uniéndote…">Unirme al programa</SubmitButton>
    </form>
  );
}
