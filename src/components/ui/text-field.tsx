import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  errors?: string[];
};

/** Labeled input with its validation errors underneath. */
export function TextField({ label, name, errors, id, className, ...inputProps }: TextFieldProps) {
  const inputId = id ?? name;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={`h-11 rounded-lg border bg-transparent px-3 text-base outline-none transition-colors focus:border-foreground ${
          hasError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
        } ${className ?? ""}`}
        {...inputProps}
      />
      {hasError && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
