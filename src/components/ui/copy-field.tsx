"use client";

import { useState } from "react";

type CopyFieldProps = {
  value: string;
  /** Accessible name of the read-only field. */
  label: string;
};

/** Read-only text (such as a link) with a "Copy" button. */
export function CopyField({ value, label }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-background px-3 text-sm dark:border-zinc-700"
      />
      <button
        type="button"
        onClick={copy}
        className="h-11 shrink-0 rounded-full bg-foreground px-6 font-medium text-background"
      >
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
