import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  errors?: string[];
};

/** Labeled <select> with its validation errors underneath. */
export function SelectField({ label, name, options, placeholder, errors, id, ...selectProps }: SelectFieldProps) {
  const selectId = id ?? name;
  const errorId = `${selectId}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={selectId}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={`h-11 rounded-lg border bg-background px-3 text-base outline-none transition-colors focus:border-foreground ${
          hasError ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
        }`}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
