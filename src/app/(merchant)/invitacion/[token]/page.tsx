import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/modules/auth";
import { acceptInvitation, getInvitationPreview, type InvitationStatus } from "@/modules/merchants";
import { AuthCard } from "@/components/ui/auth-card";
import { Loading } from "@/components/ui/loading";
import { primaryButton } from "@/components/ui/styles";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitación" };

const UNUSABLE: Record<Exclude<InvitationStatus, "valid" | "already_member">, string> = {
  not_found: "Esta invitación no existe o fue revocada.",
  used: "Esta invitación ya se usó.",
  expired: "Esta invitación venció.",
};

export default function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ token }) => (
        <Invitation token={token} />
      ))}
    </Suspense>
  );
}

async function Invitation({ token }: { token: string }) {
  // Without a session: login (or sign up) and come back here.
  await requireUser(`/invitacion/${token}`);
  const preview = await getInvitationPreview(token);

  if (preview.status === "valid") {
    return (
      <AuthCard
        title="Te invitaron a un comercio"
        description={`Únete a «${preview.merchantName}» como personal.`}
        footer={<Link href="/panel" className="underline underline-offset-4">Ahora no</Link>}
      >
        <AcceptForm action={acceptInvitation.bind(null, token)} />
      </AuthCard>
    );
  }

  if (preview.status === "already_member") {
    return (
      <AuthCard title="Ya eres parte de este comercio" description={`Ya perteneces a «${preview.merchantName}».`}>
        <Link href="/panel" className={primaryButton}>
          Ir a mis comercios
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Enlace no válido"
      description={`${UNUSABLE[preview.status]} Pide un enlace nuevo al dueño del comercio.`}
    >
      <Link href="/panel" className={primaryButton}>
        Ir a mis comercios
      </Link>
    </AuthCard>
  );
}
