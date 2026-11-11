import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath, signIn } from "@/modules/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Iniciar sesión"
      footer={
        <Suspense fallback={null}>
          <SignUpLink searchParams={searchParams} />
        </Suspense>
      }
    >
      {/* searchParams are request-time data, so the form waits behind Suspense. */}
      <Suspense fallback={<Loading />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm action={signIn} next={safeNextPath(next)} />;
}

/** "Create account" link that keeps `next` (e.g. someone arriving from an invitation). */
async function SignUpLink({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  const href = next === DEFAULT_AFTER_SIGN_IN ? "/registro" : `/registro?next=${encodeURIComponent(next)}`;
  return (
    <>
      ¿No tienes cuenta?{" "}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4">
        Crear cuenta
      </Link>
    </>
  );
}
