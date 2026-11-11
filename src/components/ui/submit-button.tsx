"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type SubmitButtonProps = {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
};

/** Form submit button that disables itself and shows a message while the form is sending. */
export function SubmitButton({ children, pendingText = "Enviando…", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const styles =
    variant === "primary"
      ? "bg-foreground text-background"
      : "border border-zinc-300 dark:border-zinc-700";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`h-11 rounded-full px-6 font-medium transition-opacity disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
