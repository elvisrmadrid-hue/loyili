import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCustomer, searchCustomers, type Customer } from "@/modules/customers";
import { enrollCustomer, identifyCustomer } from "@/modules/identification";
import { recordPurchase } from "@/modules/ledger";
import { formatPoints, getLoyaltyProgram } from "@/modules/loyalty";
import { getBranches } from "@/modules/merchants";
import { getActiveRewards, redeemReward } from "@/modules/rewards";
import { FormAlert } from "@/components/ui/form-alert";
import { Loading } from "@/components/ui/loading";
import { LocalDate } from "@/components/ui/local-date";
import { card, mutedText, secondaryButton } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";
import { IdentifyForm } from "./identify-form";
import { PurchaseForm } from "./purchase-form";
import { RedeemList } from "./redeem-list";

export const metadata: Metadata = { title: "Caja" };

/**
 * Cash register: identify the customer once (their wallet code, scanned or typed, or a name
 * search), then record a purchase or redeem a reward.
 */
export default function CashRegisterPage({ params, searchParams }: PageProps<"/panel/[merchantId]/caja">) {
  return (
    <Suspense fallback={<Loading />}>
      {Promise.all([params, searchParams]).then(([{ merchantId }, query]) => (
        <CashRegister
          merchantId={merchantId}
          search={typeof query.q === "string" ? query.q : ""}
          membershipId={typeof query.cliente === "string" ? query.cliente : null}
          justEnrolled={query.nuevo === "1"}
        />
      ))}
    </Suspense>
  );
}

async function CashRegister({
  merchantId,
  search,
  membershipId,
  justEnrolled,
}: {
  merchantId: string;
  search: string;
  membershipId: string | null;
  justEnrolled: boolean;
}) {
  const membership = await loadMembership(merchantId);
  const [program, rewards] = await Promise.all([getLoyaltyProgram(merchantId), getActiveRewards(merchantId)]);
  const base = `/panel/${merchantId}/caja`;
  const canEarn = Boolean(program?.isActive);
  const isOwner = membership.role === "owner";

  // Pausing the program stops earning, not redeeming: the register is useful while either works.
  if (!canEarn && rewards.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Caja</h1>
        <p className={card}>
          El programa de puntos no está activo y no hay recompensas activas, así que por ahora no hay nada que
          registrar.{" "}
          {isOwner ? (
            <Link href={`/panel/${merchantId}/programa`} className="font-medium underline underline-offset-4">
              Ir a Programa
            </Link>
          ) : (
            "Avisa al dueño del comercio."
          )}
        </p>
      </>
    );
  }

  const selected = membershipId ? await getCustomer(merchantId, membershipId) : null;

  if (selected) {
    const branches = canEarn ? await getBranches(merchantId) : [];
    const backHref = search ? `${base}?q=${encodeURIComponent(search)}` : base;
    return (
      <>
        <h1 className="text-2xl font-semibold">Caja</h1>
        {justEnrolled && (
          <FormAlert message={`¡Listo! ${selected.fullName} ya es cliente. Registra su compra para darle sus primeros puntos.`} />
        )}
        <section className={`${card} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{selected.fullName}</p>
            <p className={mutedText}>
              Saldo: <strong>{formatPoints(selected.pointsBalance, membership.currency)}</strong> · cliente desde{" "}
              <LocalDate iso={selected.joinedAt} />
            </p>
          </div>
          <Link href={backHref} className="shrink-0 text-sm underline underline-offset-4">
            Cambiar cliente
          </Link>
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold">Registrar compra</h2>
          {canEarn && program ? (
            <PurchaseForm
              action={recordPurchase.bind(null, merchantId)}
              merchantId={merchantId}
              membershipId={selected.membershipId}
              customerName={selected.fullName}
              currency={membership.currency}
              rule={program}
              branches={branches.map((branch) => ({ id: branch.id, name: branch.name }))}
              // A new key on every render (also after each purchase, which refreshes the page).
              idempotencyKey={crypto.randomUUID()}
            />
          ) : (
            <p className={mutedText}>
              El programa está pausado: no se dan puntos por compras. Los clientes sí pueden canjear los que ya
              tienen.
            </p>
          )}
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="font-semibold">Canjear recompensa</h2>
          {rewards.length > 0 ? (
            <RedeemList
              action={redeemReward.bind(null, merchantId)}
              membershipId={selected.membershipId}
              customerName={selected.fullName}
              balance={selected.pointsBalance}
              currency={membership.currency}
              rewards={rewards}
              idempotencyKey={crypto.randomUUID()}
            />
          ) : (
            <p className={mutedText}>
              Este comercio aún no tiene recompensas activas.{" "}
              {isOwner && (
                <Link href={`/panel/${merchantId}/recompensas`} className="underline underline-offset-4">
                  Crear recompensas
                </Link>
              )}
            </p>
          )}
        </section>
      </>
    );
  }

  const results = await searchCustomers(merchantId, search);
  return (
    <>
      <h1 className="text-2xl font-semibold">Caja</h1>
      <IdentifyForm
        identifyAction={identifyCustomer.bind(null, merchantId)}
        enrollAction={enrollCustomer.bind(null, merchantId)}
        canEnroll={canEarn}
      />

      <h2 className="font-semibold">O busca por nombre</h2>
      <form action={base} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="q" className="sr-only">
          Buscar cliente por nombre
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Buscar cliente por nombre"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base outline-none focus:border-foreground dark:border-zinc-700"
        />
        <button type="submit" className={secondaryButton}>
          Buscar
        </button>
      </form>

      {membershipId && <p className={mutedText}>Ese cliente no existe en este comercio. Búscalo de nuevo.</p>}

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{search ? `Resultados para «${search}»` : "Clientes recientes"}</h3>
        {results.length === 0 ? (
          <p className={mutedText}>
            {search
              ? "No hay clientes con ese nombre. Si es nuevo, pídele su código («Mi código» en su billetera) y únelo desde arriba."
              : "Aún no tienes clientes. Se unen con el enlace o el QR de la pestaña Clientes, o aquí con su código."}
          </p>
        ) : (
          <CustomerResults results={results} base={base} search={search} currency={membership.currency} />
        )}
      </section>
    </>
  );
}

function CustomerResults({
  results,
  base,
  search,
  currency,
}: {
  results: Customer[];
  base: string;
  search: string;
  currency: string;
}) {
  const query = search ? `&q=${encodeURIComponent(search)}` : "";
  return (
    <ul className={`${card} flex flex-col divide-y divide-zinc-200 py-0 dark:divide-zinc-800`}>
      {results.map((customer) => (
        <li key={customer.membershipId}>
          <Link
            href={`${base}?cliente=${customer.membershipId}${query}`}
            className="flex items-center justify-between gap-3 py-3 hover:underline"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{customer.fullName}</span>
              <span className={mutedText}>
                cliente desde <LocalDate iso={customer.joinedAt} />
              </span>
            </span>
            <span className={`${mutedText} shrink-0`}>{formatPoints(customer.pointsBalance, currency)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
