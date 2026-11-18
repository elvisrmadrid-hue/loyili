import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { getMyMemberships } from "@/modules/customers";
import { describeRule, formatPoints } from "@/modules/loyalty";
import { getMyMerchants } from "@/modules/merchants";
import { AppHeader } from "@/components/app-header";
import { FormAlert } from "@/components/ui/form-alert";
import { Loading } from "@/components/ui/loading";
import { LocalDate } from "@/components/ui/local-date";
import { ProgramStatus } from "@/components/ui/program-status";
import { card, mutedText, primaryButton } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Mi billetera" };

export default function WalletPage({ searchParams }: PageProps<"/wallet">) {
  // The session is read at request time, so it lives behind a Suspense boundary (Cache Components).
  return (
    <Suspense fallback={<Loading />}>
      <WalletContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WalletContent({ searchParams }: Pick<PageProps<"/wallet">, "searchParams">) {
  const user = await requireUser("/wallet");
  const [profile, memberships, merchants, { nuevo }] = await Promise.all([
    getCurrentProfile(),
    getMyMemberships(),
    getMyMerchants(),
    searchParams,
  ]);
  const name = profile?.fullName ?? user.email ?? "Usuario";
  // Set by joinMerchant() right after joining: show a welcome message.
  const joined = memberships.find((membership) => membership.merchantId === nuevo);

  return (
    <>
      <AppHeader userName={name} signOutAction={signOut} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Mis programas</h1>
          <Link href="/wallet/codigo" className={primaryButton}>
            Mi código
          </Link>
        </div>

        {joined && <FormAlert message={`¡Listo! Ya eres cliente de «${joined.merchantName}».`} />}

        {memberships.length === 0 ? (
          <div className={`${card} flex flex-col gap-2`}>
            <p className="font-medium">Todavía no te has unido a ningún programa.</p>
            <p className={mutedText}>
              Escanea el código QR de un comercio con la cámara de tu teléfono (o abre su enlace) para
              unirte y empezar a ganar puntos. También puedes mostrar «Mi código» en caja y que te unan ahí.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {memberships.map((membership) => (
              <li key={membership.id}>
                <Link
                  href={`/wallet/${membership.merchantId}`}
                  className={`${card} flex flex-col gap-1 hover:border-foreground`}
                >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-lg font-semibold">{membership.merchantName}</p>
                  {membership.program && !membership.program.isActive && <ProgramStatus active={false} />}
                </div>
                <p className="text-3xl font-semibold">{formatPoints(membership.pointsBalance, membership.currency)}</p>
                <p>
                  {membership.program
                    ? `Ganas ${describeRule(membership.program, membership.currency)} gastados.`
                    : "Este comercio aún no tiene programa de puntos."}
                </p>
                <p className={mutedText}>
                  Cliente desde el <LocalDate iso={membership.joinedAt} /> · Ver movimientos
                </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href={merchants.length > 0 ? "/panel" : "/panel/nuevo"} className="text-sm underline underline-offset-4">
          {merchants.length > 0 ? "Ir al panel de mis comercios" : "¿Tienes un negocio? Crea tu programa de puntos"}
        </Link>
      </main>
    </>
  );
}
