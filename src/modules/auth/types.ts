/** Result returned by auth Server Actions to their forms (via useActionState). */
export type AuthFormState =
  | {
      /** General error shown above the form. */
      error?: string;
      /** Success message (e.g. "we sent you an email"). */
      message?: string;
      /** Validation errors per field. */
      fieldErrors?: Partial<Record<string, string[]>>;
      /** Non-sensitive values to refill the form after an error (never passwords). */
      values?: Record<string, string>;
    }
  | undefined;

/** The signed-in user, as verified on the server. */
export type SessionUser = {
  id: string;
  email: string | null;
};

/** Row of public.profiles, in camelCase. */
export type Profile = {
  id: string;
  fullName: string;
};
