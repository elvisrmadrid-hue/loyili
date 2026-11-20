"use client";

import { useFormStatus } from "react-dom";

type ConfirmActionButtonProps = {
  /** Server Action to run (usually with its arguments already bound). */
  action: () => Promise<void>;
  /** Question shown in the browser's confirmation dialog. */
  confirmMessage: string;
  label: string;
  pendingLabel?: string;
};

/** Small destructive button (delete, revoke, remove) that asks for confirmation first. */
export function ConfirmActionButton({ action, confirmMessage, label, pendingLabel }: ConfirmActionButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <Button label={label} pendingLabel={pendingLabel ?? label} />
    </form>
  );
}

function Button({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
