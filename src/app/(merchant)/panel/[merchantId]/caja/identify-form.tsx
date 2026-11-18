"use client";

import dynamic from "next/dynamic";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/lib/forms";
import { formatCustomerCode } from "@/modules/identification/rules";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { card, mutedText, secondaryButton } from "@/components/ui/styles";

// The scanner (and the QR reader inside it) is downloaded only when "Escanear QR" is pressed.
const QrScanner = dynamic(() => import("./qr-scanner").then((module) => module.QrScanner), { ssr: false });

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

type IdentifyFormProps = {
  identifyAction: Action;
  enrollAction: Action;
  /** The program is active, so someone who is not a customer yet can be enrolled. */
  canEnroll: boolean;
};

/**
 * Identifies the customer with the code of their wallet: scanned with the camera or typed.
 * A customer opens directly (the action redirects); someone new can be enrolled.
 */
export function IdentifyForm({ identifyAction, enrollAction, canEnroll }: IdentifyFormProps) {
  const [state, formAction] = useActionState(identifyAction, undefined);
  const [enrollState, enrollFormAction] = useActionState(enrollAction, undefined);
  const [scanning, setScanning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = state?.values?.status === "not_customer" ? state.values : null;
  const codeError = state?.fieldErrors?.code?.[0];

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">Código del cliente</h2>
      <p className={mutedText}>El cliente lo encuentra en su billetera, en «Mi código».</p>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="code" className="sr-only">
            Código del cliente
          </label>
          <input
            ref={inputRef}
            id="code"
            name="code"
            // Remount with the submitted value after each answer (also without JavaScript).
            key={state?.values?.code ?? ""}
            defaultValue={state?.values?.code ?? ""}
            placeholder="K7P2-QX4M"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? "code-error" : undefined}
            className={`h-11 rounded-lg border bg-transparent px-3 font-mono text-base tracking-widest uppercase outline-none focus:border-foreground ${
              codeError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {codeError && (
            <p id="code-error" className="text-sm text-red-600 dark:text-red-400">
              {codeError}
            </p>
          )}
        </div>
        <SubmitButton pendingText="Buscando…">Abrir</SubmitButton>
        <button type="button" onClick={() => setScanning((on) => !on)} className={secondaryButton}>
          {scanning ? "Cerrar cámara" : "Escanear QR"}
        </button>
      </form>

      {scanning && (
        <QrScanner
          onCode={(code) => {
            setScanning(false);
            inputRef.current!.value = formatCustomerCode(code);
            formRef.current!.requestSubmit();
          }}
        />
      )}

      <FormAlert error={state?.error} />

      {pending && (
        <div className="flex flex-col gap-3 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
          <p>
            <strong>{pending.name}</strong> aún no es cliente de este comercio.
          </p>
          {canEnroll ? (
            <form action={enrollFormAction} className="flex flex-col gap-2">
              <input type="hidden" name="code" value={pending.code} />
              <FormAlert error={enrollState?.error} />
              <SubmitButton pendingText="Uniendo…">Unirlo al programa</SubmitButton>
            </form>
          ) : (
            <p className={mutedText}>El programa de puntos está pausado: por ahora no se pueden unir clientes nuevos.</p>
          )}
        </div>
      )}
    </section>
  );
}
