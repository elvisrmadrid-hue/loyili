import { z } from "zod";

/** Result a Server Action returns to its form (via useActionState). */
export type FormState =
  | {
      /** General error shown above the form. */
      error?: string;
      /** Success message. */
      message?: string;
      /** Validation errors per field. */
      fieldErrors?: Partial<Record<string, string[]>>;
      /** Non-sensitive values to refill the form after an error (never passwords). */
      values?: Record<string, string>;
    }
  | undefined;

/** Reads a text field from a submitted form ("" if missing). */
export function formField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Zod validation errors grouped by field. */
export function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
}
