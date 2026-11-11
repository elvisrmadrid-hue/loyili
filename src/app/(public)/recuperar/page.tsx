import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requestPasswordReset } from "@/modules/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { RequestResetForm } from "./request-reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RequestResetPage({ searchParams }: PageProps<"/recuperar">) {
  return (
    <AuthCard
      title="Recuperar contraseña"
      description="Te enviaremos un enlace a tu email para crear una contraseña nueva."
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      }
    >
      <Suspense fallback={<Loading />}>
        <RequestResetFormWithError searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function RequestResetFormWithError({
  searchParams,
}: Pick<PageProps<"/recuperar">, "searchParams">) {
  const { error } = await searchParams;
  const initialError =
    error === "enlace-invalido" ? "El enlace expiró o ya se usó. Solicita uno nuevo." : undefined;

  return <RequestResetForm action={requestPasswordReset} initialError={initialError} />;
}
