import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_AFTER_SIGN_IN, PASSWORD_MIN_LENGTH, safeNextPath, signUp } from "@/modules/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage({ searchParams }: PageProps<"/registro">) {
  return (
    <AuthCard
      title="Crear cuenta"
      description="Una sola cuenta para acumular puntos y, si quieres, gestionar tu comercio."
      footer={
        <Suspense fallback={null}>
          <LoginLink searchParams={searchParams} />
        </Suspense>
      }
    >
      {/* searchParams are request-time data, so the form waits behind Suspense. */}
      <Suspense fallback={<Loading />}>
        <SignUpFormWithNext searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignUpFormWithNext({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  return <SignUpForm action={signUp} passwordMinLength={PASSWORD_MIN_LENGTH} next={next} />;
}

/** "Sign in" link that keeps `next`. */
async function LoginLink({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  const href = next === DEFAULT_AFTER_SIGN_IN ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <>
      ¿Ya tienes cuenta?{" "}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4">
        Iniciar sesión
      </Link>
    </>
  );
}
