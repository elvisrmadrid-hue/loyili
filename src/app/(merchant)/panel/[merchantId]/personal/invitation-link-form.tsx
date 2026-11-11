"use client";

import { useActionState, useState } from "react";
import type { InvitationLinkState } from "@/modules/merchants";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";

type InvitationLinkFormProps = {
  action: (state: InvitationLinkState) => Promise<InvitationLinkState>;
};

/** Generates a single-use invitation link and lets the owner copy it. Shown only once. */
export function InvitationLinkForm({ action }: InvitationLinkFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch {
      setCopiedUrl(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FormAlert error={state?.error} />
      {state?.url && (
        <div className="flex flex-col gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Enlace creado. Cópialo y envíalo a la persona (por WhatsApp, por ejemplo). Por seguridad
            solo se muestra ahora; vale 7 días y sirve una sola vez.
          </p>
          <input
            readOnly
            value={state.url}
            aria-label="Enlace de invitación"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 rounded-lg border border-zinc-300 bg-background px-3 text-sm dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={() => copy(state.url!)}
            className="h-11 rounded-full bg-foreground px-6 font-medium text-background"
          >
            {copiedUrl === state.url ? "¡Copiado!" : "Copiar enlace"}
          </button>
        </div>
      )}
      <form action={formAction}>
        <SubmitButton pendingText="Generando…" variant={state?.url ? "secondary" : "primary"}>
          {state?.url ? "Generar otro enlace" : "Generar enlace de invitación"}
        </SubmitButton>
      </form>
    </div>
  );
}
