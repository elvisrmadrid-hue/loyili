import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, PASSWORD_MIN_LENGTH, updatePassword } from "@/modules/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UpdatePasswordContent />
    </Suspense>
  );
}

async function UpdatePasswordContent() {
  // The recovery link (via /auth/confirm) signs the user in; without a session this page is useless.
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="Enlace no válido"
        description="Para crear una contraseña nueva, abre el enlace que te enviamos por email."
        footer={
          <Link href="/recuperar" className="font-medium text-foreground underline underline-offset-4">
            Solicitar un enlace nuevo
          </Link>
        }
      >
        {null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Crea una contraseña nueva"
      description={user.email ? `Para la cuenta ${user.email}` : undefined}
    >
      <UpdatePasswordForm action={updatePassword} passwordMinLength={PASSWORD_MIN_LENGTH} />
    </AuthCard>
  );
}
