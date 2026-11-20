"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCountdown, RENEW_BEFORE_SECONDS } from "@/modules/identification/rules";
import type { IssuedCode } from "@/modules/identification/types";
import { FormAlert } from "@/components/ui/form-alert";
import { card, mutedText, secondaryButton } from "@/components/ui/styles";

/** After a failed renewal (no connection), try again at most this often. */
const RETRY_MS = 10_000;

type CustomerCodeProps = {
  issueAction: () => Promise<IssuedCode | { error: string }>;
};

/**
 * The customer's QR and short code with a countdown.
 *
 * The code is always requested by the browser when this screen appears (never embedded in
 * the page): the router keeps copies of visited pages for back/forward navigation, and a
 * copy would show an old code with a countdown that starts again at 5:00. It is renewed
 * shortly before it expires, also when the phone wakes up (timers sleep in the background).
 */
export function CustomerCode({ issueAction }: CustomerCodeProps) {
  const [code, setCode] = useState<IssuedCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Moment (local clock) when the current code expires; 0 = no code yet.
  const deadline = useRef(0);
  const renewing = useRef(false);
  const lastAttempt = useRef(0);

  // State changes only when the server answers (in the promise callbacks).
  const renew = useCallback(() => {
    if (renewing.current) return;
    renewing.current = true;
    lastAttempt.current = Date.now();
    issueAction()
      .then(
        (result) => {
          if ("error" in result) {
            setError(result.error);
            return;
          }
          // Counted from when the answer arrives, with this device's own clock.
          deadline.current = Date.now() + result.validSeconds * 1000;
          setCode(result);
          setRemaining(result.validSeconds);
          setError(null);
        },
        () => setError("No se pudo obtener tu código. Revisa tu conexión."),
      )
      .finally(() => {
        renewing.current = false;
      });
  }, [issueAction]);

  useEffect(() => {
    // A fresh code every time the screen appears.
    renew();

    const tick = () => {
      if (deadline.current === 0) return;
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= RENEW_BEFORE_SECONDS && Date.now() - lastAttempt.current >= RETRY_MS) renew();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };

    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [renew]);

  if (!code) {
    return (
      <section className={`${card} flex flex-col items-center gap-4 text-center`}>
        {error ? (
          <>
            <FormAlert error={error} />
            <button type="button" onClick={() => renew()} className={secondaryButton}>
              Intentar de nuevo
            </button>
          </>
        ) : (
          <>
            <div className="size-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" aria-hidden />
            <p className={mutedText} role="status">
              Generando tu código…
            </p>
          </>
        )}
      </section>
    );
  }

  const expired = remaining === 0;

  return (
    <section className={`${card} flex flex-col items-center gap-4 text-center`}>
      <p>Muéstralo en caja para sumar puntos o canjear recompensas.</p>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
        <img
          src={code.qr}
          alt={`Código QR ${code.display}`}
          width={256}
          height={256}
          className={`size-64 rounded-lg bg-white p-2 transition-opacity ${expired ? "opacity-15" : ""}`}
        />
        {expired && (
          <p className="absolute inset-0 flex items-center justify-center px-6 font-semibold">El código caducó</p>
        )}
      </div>
      <p className="font-mono text-3xl font-semibold tracking-widest" aria-label={`Código ${code.display.split("").join(" ")}`}>
        {code.display}
      </p>
      {expired ? (
        <button type="button" onClick={() => renew()} className={secondaryButton}>
          Generar otro código
        </button>
      ) : (
        <p className={mutedText}>Válido por {formatCountdown(remaining)} · se renueva solo</p>
      )}
      {error && <FormAlert error={error} />}
      <p className={mutedText}>
        Sube el brillo de la pantalla si la cámara no lo lee. También pueden escribir el código de arriba.
      </p>
    </section>
  );
}
