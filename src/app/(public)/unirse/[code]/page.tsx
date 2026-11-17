import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getJoinPreview, joinMerchant, joinPath, type JoinPreview } from "@/modules/customers";
import { describeRule } from "@/modules/loyalty";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { primaryButton, secondaryButton } from "@/components/ui/styles";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Únete al programa" };

/** Public page behind a merchant's join link / QR. Works with or without a session. */
export default function JoinPage({ params }: PageProps<"/unirse/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ code }) => (
        <Join rawCode={code} />
      ))}
    </Suspense>
  );
}

async function Join({ rawCode }: { rawCode: string }) {
  const preview = await getJoinPreview(rawCode);

  if (!preview) {
    return (
      <AuthCard
        title="Enlace no válido"
        description="Este código no corresponde a ningún comercio. Revisa el enlace o vuelve a escanear el QR."
      >
        <Link href="/" className={primaryButton}>
          Ir al inicio
        </Link>
      </AuthCard>
    );
  }

  const { merchantName, viewerStatus, programStatus } = preview;

  if (viewerStatus === "member") {
    return (
      <AuthCard
        title="Trabajas en este comercio"
        description={`El dueño y el personal de «${merchantName}» no pueden unirse como clientes de su propio comercio.`}
      >
        <Link href="/panel" className={primaryButton}>
          Ir a mis comercios
        </Link>
      </AuthCard>
    );
  }

  if (viewerStatus === "customer") {
    return (
      <AuthCard title="Ya eres cliente" description={`Ya perteneces al programa de «${merchantName}».`}>
        <Link href="/wallet" className={primaryButton}>
          Ir a mi billetera
        </Link>
      </AuthCard>
    );
  }

  if (programStatus !== "active" || !preview.rule) {
    return (
      <AuthCard
        title={merchantName}
        description="Este comercio no tiene su programa de puntos activo en este momento, así que por ahora no es posible unirse. Inténtalo más tarde."
      >
        <Link href="/" className={secondaryButton}>
          Ir al inicio
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Únete a ${merchantName}`}
      description={`Gana ${describeRule(preview.rule, preview.currency)} gastados en tus compras.`}
    >
      {viewerStatus === "anonymous" ? <SignInChoices preview={preview} /> : <JoinForm action={joinMerchant.bind(null, preview.code)} />}
    </AuthCard>
  );
}

/** Signed out: create an account or sign in, then come back to this page. */
function SignInChoices({ preview }: { preview: JoinPreview }) {
  const next = encodeURIComponent(joinPath(preview.code));
  return (
    <div className="flex flex-col gap-3">
      <Link href={`/registro?next=${next}`} className={primaryButton}>
        Crear cuenta para unirme
      </Link>
      <Link href={`/login?next=${next}`} className={secondaryButton}>
        Ya tengo cuenta
      </Link>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Es gratis. Después volverás aquí para unirte con un clic.
      </p>
    </div>
  );
}
