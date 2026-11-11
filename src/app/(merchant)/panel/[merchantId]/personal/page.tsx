import type { Metadata } from "next";
import { Suspense } from "react";
import {
  createInvitation,
  getPendingInvitations,
  getTeam,
  removeMember,
  revokeInvitation,
} from "@/modules/merchants";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { LocalDate } from "@/components/ui/local-date";
import { Loading } from "@/components/ui/loading";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";
import { InvitationLinkForm } from "./invitation-link-form";

export const metadata: Metadata = { title: "Personal" };

export default function TeamPage({ params }: PageProps<"/panel/[merchantId]/personal">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Team merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Team({ merchantId }: { merchantId: string }) {
  await loadMembership(merchantId, { ownerOnly: true });
  const [team, invitations] = await Promise.all([getTeam(merchantId), getPendingInvitations(merchantId)]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Personal</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Equipo</h2>
        <ul className={`${card} flex flex-col divide-y divide-zinc-200 py-0 dark:divide-zinc-800`}>
          {team.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{member.fullName}</p>
                <p className={mutedText}>
                  {member.role === "owner" ? "Dueño" : "Personal"} · desde <LocalDate iso={member.joinedAt} />
                </p>
              </div>
              {member.role === "staff" && (
                <ConfirmActionButton
                  action={removeMember.bind(null, merchantId, member.userId)}
                  confirmMessage={`¿Quitar a ${member.fullName} del personal? Perderá el acceso de inmediato.`}
                  label="Quitar"
                  pendingLabel="Quitando…"
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Invitar a alguien</h2>
          <p className={mutedText}>
            Genera un enlace y compártelo. La persona inicia sesión (o crea su cuenta), acepta y queda
            como personal de este comercio.
          </p>
        </div>
        <InvitationLinkForm action={createInvitation.bind(null, merchantId)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Invitaciones pendientes</h2>
        {invitations.length === 0 ? (
          <p className={mutedText}>No hay invitaciones pendientes.</p>
        ) : (
          <ul className={`${card} flex flex-col divide-y divide-zinc-200 py-0 dark:divide-zinc-800`}>
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                <div className={mutedText}>
                  <p>
                    Creada el <LocalDate iso={invitation.createdAt} withTime />
                  </p>
                  <p>
                    {invitation.expired ? (
                      <span className="font-medium text-red-600 dark:text-red-400">Vencida</span>
                    ) : (
                      <>
                        Vence el <LocalDate iso={invitation.expiresAt} withTime />
                      </>
                    )}
                  </p>
                </div>
                <ConfirmActionButton
                  action={revokeInvitation.bind(null, merchantId, invitation.id)}
                  confirmMessage={
                    invitation.expired ? "¿Borrar esta invitación vencida?" : "¿Revocar esta invitación? El enlace dejará de funcionar."
                  }
                  label={invitation.expired ? "Borrar" : "Revocar"}
                  pendingLabel="…"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
