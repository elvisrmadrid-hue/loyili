import type { ReactNode } from "react";
import { formatMoney } from "@/lib/currencies";
import { LocalDate } from "./local-date";
import { mutedText } from "./styles";

/** The fields of a ledger movement this list shows (merchant and customer views). */
export type TransactionItem = {
  id: string;
  type: "EARN" | "REDEEM" | "REVERSAL";
  points: number;
  purchaseAmountMinor: number | null;
  currency: string;
  rewardName: string | null;
  note: string | null;
  createdAt: string;
  branchName: string | null;
  authorName: string | null;
  reversed: boolean;
};

type TransactionListProps = {
  transactions: TransactionItem[];
  /** Formats a signed number of points ("+25 puntos"). */
  formatPoints: (points: number) => string;
  /** Extra content under a movement (e.g. the owner's "Anular" form). */
  renderActions?: (transaction: TransactionItem) => ReactNode;
  emptyText: string;
};

/** What a movement was, in words. A reversal that gives points back cancelled a redemption. */
function describe(transaction: TransactionItem): string {
  if (transaction.type === "EARN") {
    return `Compra de ${formatMoney(transaction.purchaseAmountMinor ?? 0, transaction.currency)}`;
  }
  if (transaction.type === "REDEEM") return `Canje: ${transaction.rewardName ?? "recompensa"}`;
  return transaction.points > 0 ? "Anulación de canje" : "Anulación de compra";
}

/** Points history: purchases, redemptions and reversals, newest first. */
export function TransactionList({ transactions, formatPoints, renderActions, emptyText }: TransactionListProps) {
  if (transactions.length === 0) return <p className={mutedText}>{emptyText}</p>;

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
      {transactions.map((transaction) => {
        const details = [
          transaction.branchName,
          transaction.authorName ? `registró ${transaction.authorName}` : null,
        ].filter(Boolean);
        return (
          <li key={transaction.id} className="flex flex-col gap-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {describe(transaction)}
                  {transaction.reversed && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {transaction.type === "EARN" ? "anulada" : "anulado"}
                    </span>
                  )}
                </p>
                <p className={mutedText}>
                  <LocalDate iso={transaction.createdAt} withTime />
                  {details.length > 0 && ` · ${details.join(" · ")}`}
                </p>
                {transaction.note && <p className={mutedText}>Motivo: {transaction.note}</p>}
              </div>
              <p
                className={`shrink-0 font-semibold ${
                  transaction.points < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {formatPoints(transaction.points)}
              </p>
            </div>
            {renderActions?.(transaction)}
          </li>
        );
      })}
    </ul>
  );
}
