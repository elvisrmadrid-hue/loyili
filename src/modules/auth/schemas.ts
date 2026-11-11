import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .string({ error: "Ingresa tu email." })
  .trim()
  .toLowerCase()
  .min(1, { error: "Ingresa tu email." })
  .pipe(z.email({ error: "Ingresa un email válido." }));

const newPassword = z
  .string({ error: "Ingresa una contraseña." })
  .min(PASSWORD_MIN_LENGTH, {
    error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(72, { error: "La contraseña no puede tener más de 72 caracteres." });

export const signUpSchema = z.object({
  fullName: z
    .string({ error: "Ingresa tu nombre." })
    .trim()
    .min(1, { error: "Ingresa tu nombre." })
    .max(100, { error: "El nombre no puede tener más de 100 caracteres." }),
  email,
  password: newPassword,
});

export const signInSchema = z.object({
  email,
  password: z.string({ error: "Ingresa tu contraseña." }).min(1, { error: "Ingresa tu contraseña." }),
});

export const requestPasswordResetSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string({ error: "Repite la contraseña." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });
