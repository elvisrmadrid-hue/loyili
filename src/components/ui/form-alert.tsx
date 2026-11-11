type FormAlertProps = {
  error?: string;
  message?: string;
};

/** General error or success message shown at the top of a form. */
export function FormAlert({ error, message }: FormAlertProps) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        {message}
      </p>
    );
  }
  return null;
}
