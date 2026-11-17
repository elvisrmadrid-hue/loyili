import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCustomer } from "@/modules/customers";
import { getTransactions, reverseTransaction } from "@/modules/ledger";
import { formatMoney } from "@/lib/currencies";
import { formatPoints } from "@/modules/loyalty";
import { Loading } from "@/components/ui/loading";
import { LocalDate } from "@/components/ui/local-date";
import { TransactionList } from "@/components/ui/transaction-list";
import { card, mutedText, primaryButton } from "@/components/ui/styles";
import { loadMembership } from "../../load-membership";
import { ReverseForm } from "./reverse-form";

export const metadata: Metadata = { title: "Cliente" };

export default function CustomerPage({ params }: PageProps<"/panel/[merchantId]/clientes/[membershipId]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId, membershipId }) => (
        <CustomerDetail merchantId={merchantId} membershipId={membershipId} />
      ))}
    </Suspense>
  );
}

async function CustomerDetail({ merchantId, membershipId }: { merchantId: string; membershipId: string }) {
  const membership = await loadMembership(merchantId);
  const customer = await getCustomer(merchantId, membershipId);
  if (!customer) notFound();

  const currency = membership.currency;
  const isOwner = membership.role === "owner";
  const transactions = await getTransactions(membershipId, { forMerchant: true, withAuthor: isOwner });
  const signed = (points: number) => `${points > 0 ? "+" : ""}${formatPoints(points, currency)}`;

  return (
    <>
      <Link href={`/panel/${merchantId}/clientes`} className="text-sm underline underline-offset-4">
        ← Clientes
      </Link>

      <section className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{customer.fullName}</h1>
          <p className={mutedText}>
            Cliente desde el <LocalDate iso={customer.joinedAt} />
          </p>
        </div>
        <div className="sm:text-right">
          <p className={mutedText}>Saldo</p>
          <p className="text-2xl font-semibold">{formatPoints(customer.pointsBalance, currency)}</p>
        </div>
      </section>

      <Link href={`/panel/${merchantId}/caja?cliente=${membershipId}`} className={primaryButton}>
        Abrir en caja
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Movimientos</h2>
        <TransactionList
          transactions={transactions}
          formatPoints={signed}
          emptyText="Todavía no tiene movimientos."
          renderActions={(transaction) =>
            isOwner && transaction.type !== "REVERSAL" && !transaction.reversed ? (
              <ReverseForm
                action={reverseTransaction.bind(null, merchantId, transaction.id)}
                kind={transaction.type === "EARN" ? "compra" : "canje"}
                summary={
                  transaction.type === "EARN"
                    ? `compra de ${formatMoney(transaction.purchaseAmountMinor ?? 0, currency)} (${signed(transaction.points)})`
                    : `${transaction.rewardName ?? "recompensa"} (${signed(-transaction.points)})`
                }
                idPrefix={`reverse-${transaction.id}`}
              />
            ) : null
          }
        />
      </section>
    </>
  );
}
