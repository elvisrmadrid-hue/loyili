"use client";

import { primaryButton } from "./styles";

/** Opens the browser's print dialog. Hidden on the printed page itself. */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${primaryButton} print:hidden`}>
      {label}
    </button>
  );
}
