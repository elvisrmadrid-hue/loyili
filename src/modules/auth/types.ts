import type { FormState } from "@/lib/forms";

/** Result returned by auth Server Actions to their forms (via useActionState). */
export type AuthFormState = FormState;

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
