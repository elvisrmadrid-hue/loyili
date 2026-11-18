"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCountdown, RENEW_BEFORE_SECONDS } from "@/modules/identification/rules";
import type { IssuedCode } from "@/modules/identification/types";
import { FormAlert } from "@/components/ui/form-alert";
import { card, mutedText, secondaryButton } from "@/components/ui/styles";

/** After a failed renewal (no connection), try again at most this often. */
const RETRY_MS = 10_000;

type CustomerCodeProps = {
  initial: IssuedCode;
  renewAction: () => Promise<IssuedCode | { error: string }>;
};

/**
 * The customer's QR and short code with a countdown. Asks the server for a new code shortly
 * before the current one expires, also when the phone wakes up (timers sleep in the background).
 */
export function CustomerCode({ initial, renewAction }: CustomerCodeProps) {
  const [code, setCode] = useState(initial);
  const [remaining, setRemaining] = useState(initial.validSeconds);
  const [error, setError] = useState<string | null>(null);
  // Moment (local clock) when the current code expires. Set on mount and on each renewal.
  const deadline = useRef(0);
  const renewing = useRef(false);
  const lastAttempt = useRef(0);

  const renew = useCallback(async () => {
    if (renewing.current) return;
    renewing.current = true;
    lastAttempt.current = Date.now();
    try {
      const result = await renewAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        deadline.current = Date.now() + result.validSeconds * 1000;
        setCode(result);
        setRemaining(result.validSeconds);
        setError(null);
      }
    } catch {
      setError("No se pudo renovar tu código. Revisa tu conexión.");
    } finally {
      renewing.current = false;
    }
  }, [renewAction]);

  useEffect(() => {
    deadline.current = Date.now() + initial.validSeconds * 1000;

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= RENEW_BEFORE_SECONDS && Date.now() - lastAttempt.current >= RETRY_MS) void renew();
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
  }, [initial.validSeconds, renew]);

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
        <button type="button" onClick={() => void renew()} className={secondaryButton}>
          Generar otro código
        </button>
      ) : (
        <p className={mutedText} aria-live="off">
          Válido por {formatCountdown(remaining)} · se renueva solo
        </p>
      )}
      {error && <FormAlert error={error} />}
      <p className={mutedText}>
        Sube el brillo de la pantalla si la cámara no lo lee. También pueden escribir el código de arriba.
      </p>
    </section>
  );
}
