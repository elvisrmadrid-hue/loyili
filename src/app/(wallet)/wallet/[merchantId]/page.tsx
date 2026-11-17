import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentProfile, requireUser, signOut } from "@/modules/auth";
import { getMyMembership } from "@/modules/customers";
import { getTransactions } from "@/modules/ledger";
import { describeRule, formatPoints } from "@/modules/loyalty";
import { getActiveRewards } from "@/modules/rewards";
import { AppHeader } from "@/components/app-header";
import { Loading } from "@/components/ui/loading";
import { ProgramStatus } from "@/components/ui/program-status";
import { TransactionList } from "@/components/ui/transaction-list";
import { card, mutedText } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Mis movimientos" };

export default function WalletProgramPage({ params }: PageProps<"/wallet/[merchantId]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <WalletProgram merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function WalletProgram({ merchantId }: { merchantId: string }) {
  const user = await requireUser(`/wallet/${merchantId}`);
  const [profile, membership] = await Promise.all([getCurrentProfile(), getMyMembership(merchantId)]);
  if (!membership) notFound();

  const [transactions, rewards] = await Promise.all([getTransactions(membership.id), getActiveRewards(merchantId)]);
  const { currency } = membership;
  const signed = (points: number) => `${points > 0 ? "+" : ""}${formatPoints(points, currency)}`;

  return (
    <>
      <AppHeader userName={profile?.fullName ?? user.email ?? "Usuario"} signOutAction={signOut} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <Link href="/wallet" className="text-sm underline underline-offset-4">
          ← Mis programas
        </Link>

        <section className={`${card} flex flex-col gap-1`}>
          <div className="flex items-center justify-between gap-3">
            <h1 className="truncate text-xl font-semibold">{membership.merchantName}</h1>
            {membership.program && !membership.program.isActive && <ProgramStatus active={false} />}
          </div>
          <p className={mutedText}>Tu saldo</p>
          <p className="text-4xl font-semibold">{formatPoints(membership.pointsBalance, currency)}</p>
          {membership.program && (
            <p className={mutedText}>Ganas {describeRule(membership.program, currency)} gastados.</p>
          )}
        </section>

        {rewards.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Recompensas</h2>
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
              {rewards.map((reward) => {
                const missing = reward.pointsCost - membership.pointsBalance;
                return (
                  <li key={reward.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{reward.name}</p>
                      <p className={mutedText}>
                        {formatPoints(reward.pointsCost, currency)}
                        {reward.description && ` · ${reward.description}`}
                      </p>
                    </div>
                    {missing > 0 ? (
                      <p className={`${mutedText} shrink-0 text-right`}>Te faltan {formatPoints(missing, currency)}</p>
                    ) : (
                      <p className="shrink-0 text-right text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        ¡Ya puedes canjearla!
                        <br />
                        Pídela en caja
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Movimientos</h2>
          <TransactionList
            transactions={transactions}
            formatPoints={signed}
            emptyText="Todavía no tienes movimientos. Cuando compres en este comercio, tus puntos aparecerán aquí."
          />
        </section>
      </main>
    </>
  );
}
