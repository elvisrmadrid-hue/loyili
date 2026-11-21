import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { currencyLocale, formatMoney } from "@/lib/currencies";
import { formatPoints } from "@/modules/loyalty";
import {
  averageMinor,
  barWidth,
  getMerchantReport,
  parseReportPeriod,
  percentage,
  REPORT_PERIODS,
  type MerchantReport,
  type ReportPeriod,
} from "@/modules/reports";
import { Loading } from "@/components/ui/loading";
import { card, mutedText } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";

export const metadata: Metadata = { title: "Reportes" };

/** Owner's report: customers, purchases, points, redemptions, branches and best customers. */
export default function ReportsPage({ params, searchParams }: PageProps<"/panel/[merchantId]/reportes">) {
  return (
    <Suspense fallback={<Loading />}>
      {Promise.all([params, searchParams]).then(([{ merchantId }, query]) => (
        <Reports merchantId={merchantId} period={parseReportPeriod(query.periodo)} />
      ))}
    </Suspense>
  );
}

async function Reports({ merchantId, period }: { merchantId: string; period: ReportPeriod }) {
  await loadMembership(merchantId, { ownerOnly: true });
  const report = await getMerchantReport(merchantId, period);
  if (!report) notFound();

  const base = `/panel/${merchantId}`;
  const inPeriod = period.days ? `en los últimos ${period.days} días` : "desde el inicio";

  return (
    <>
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <nav aria-label="Periodo" className="flex flex-wrap gap-2">
        {REPORT_PERIODS.map((option) => {
          const active = option.value === period.value;
          return (
            <Link
              key={option.value}
              href={`${base}/reportes?periodo=${option.value}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ${
                active ? "bg-foreground text-background" : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {report.customers.total === 0 && report.purchases.count === 0 ? (
        <p className={card}>
          Todavía no hay datos. Cuando tus clientes se unan y registres compras en la{" "}
          <Link href={`${base}/caja`} className="font-medium underline underline-offset-4">
            Caja
          </Link>
          , aquí verás cómo funciona tu programa.
        </p>
      ) : (
        <ReportBody report={report} inPeriod={inPeriod} base={base} />
      )}

      <p className={mutedText}>
        <strong>Cliente activo</strong>: compró o canjeó al menos una vez en el periodo. Las compras y los canjes
        anulados no cuentan en ningún total. Los puntos en circulación son la suma de los saldos de tus clientes hoy.
      </p>
    </>
  );
}

function ReportBody({ report, inPeriod, base }: { report: MerchantReport; inPeriod: string; base: string }) {
  const { currency, customers, purchases, points, redemptions } = report;
  const money = (minor: number) => formatMoney(minor, currency);
  const pts = (value: number) => formatPoints(value, currency);
  // Stat cards: the label already says "Puntos", so only the number (it fits on a phone).
  const number = (value: number) => value.toLocaleString(currencyLocale(currency));

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Clientes" value={number(customers.total)} detail={`${customers.new} nuevos ${inPeriod}`} />
        <Stat
          label="Clientes activos"
          value={number(customers.active)}
          detail={`${percentage(customers.active, customers.total)} % del total`}
        />
        <Stat label="Compras" value={number(purchases.count)} detail={inPeriod} />
        <Stat label="Monto comprado" value={money(purchases.amountMinor)} detail={inPeriod} />
        <Stat
          label="Compra media"
          value={purchases.count > 0 ? money(averageMinor(purchases.amountMinor, purchases.count)) : "—"}
          detail={inPeriod}
        />
        <Stat label="Canjes" value={number(redemptions.count)} detail={inPeriod} />
        <Stat label="Puntos emitidos" value={number(points.earned)} detail={inPeriod} />
        <Stat label="Puntos canjeados" value={number(points.redeemed)} detail={inPeriod} />
        <Stat label="Puntos en circulación" value={number(points.inCirculation)} detail="saldo de todos tus clientes hoy" />
      </section>

      <Ranking
        title="Recompensas más canjeadas"
        empty={`Ningún canje ${inPeriod}.`}
        rows={redemptions.topRewards.map((reward) => ({
          key: reward.rewardId ?? reward.name,
          label: reward.name,
          value: reward.count,
          detail: `${reward.count} ${reward.count === 1 ? "canje" : "canjes"} · ${pts(reward.points)}`,
        }))}
      />

      {report.branches.length > 0 && (
        <Ranking
          title="Compras por sucursal"
          empty=""
          rows={report.branches.map((branch) => ({
            key: branch.id ?? "none",
            label: branch.name ?? "Sin sucursal",
            value: branch.amountMinor,
            detail: `${branch.count} ${branch.count === 1 ? "compra" : "compras"} · ${money(branch.amountMinor)}`,
          }))}
        />
      )}

      <Ranking
        title="Mejores clientes"
        empty={`Ninguna compra ${inPeriod}.`}
        rows={report.topCustomers.map((customer) => ({
          key: customer.membershipId,
          label: (
            <Link href={`${base}/clientes/${customer.membershipId}`} className="underline underline-offset-4">
              {customer.fullName}
            </Link>
          ),
          value: customer.amountMinor,
          detail: `${customer.count} ${customer.count === 1 ? "compra" : "compras"} · ${money(customer.amountMinor)}`,
        }))}
      />
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1`}>
      <p className={mutedText}>{label}</p>
      <p className="text-2xl font-semibold break-words">
        {value}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

type RankingRow = { key: string; label: ReactNode; value: number; detail: string };

/** A short list with proportional bars (pure CSS, no chart library). */
function Ranking({ title, rows, empty }: { title: string; rows: RankingRow[]; empty: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className={mutedText}>{empty}</p>
      ) : (
        <ul className={`${card} flex flex-col gap-4`}>
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{row.label}</span>
                <span className={`${mutedText} shrink-0`}>{row.detail}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                <div className="h-2 rounded-full bg-foreground" style={{ width: `${barWidth(row.value, max)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
