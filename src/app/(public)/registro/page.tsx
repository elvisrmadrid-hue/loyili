import type { Metadata } from "next";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH, signUp } from "@/modules/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Crear cuenta"
      description="Una sola cuenta para acumular puntos y, si quieres, gestionar tu comercio."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <SignUpForm action={signUp} passwordMinLength={PASSWORD_MIN_LENGTH} />
    </AuthCard>
  );
}
