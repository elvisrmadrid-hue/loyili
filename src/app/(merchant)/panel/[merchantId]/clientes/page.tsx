import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSiteUrl } from "@/lib/supabase/env";
import { qrSvgDataUrl } from "@/lib/qr";
import { getCustomers, joinPath } from "@/modules/customers";
import { formatPoints, getLoyaltyProgram } from "@/modules/loyalty";
import { CopyField } from "@/components/ui/copy-field";
import { Loading } from "@/components/ui/loading";
import { LocalDate } from "@/components/ui/local-date";
import { card, mutedText, secondaryButton } from "@/components/ui/styles";
import { loadMembership } from "../load-membership";

export const metadata: Metadata = { title: "Clientes" };

export default function CustomersPage({ params }: PageProps<"/panel/[merchantId]/clientes">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Customers merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

async function Customers({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId);
  const isOwner = membership.role === "owner";
  const [customers, program] = await Promise.all([getCustomers(merchantId), getLoyaltyProgram(merchantId)]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Clientes</h1>

      {isOwner && (
        <InviteCustomers
          merchantId={merchantId}
          joinCode={membership.joinCode}
          programActive={Boolean(program?.isActive)}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">
          {customers.length === 1 ? "1 cliente" : `${customers.length.toLocaleString("es")} clientes`}
        </h2>
        {customers.length === 0 ? (
          <p className={mutedText}>
            Aún no tienes clientes. Cuando alguien se una con tu enlace o tu QR, aparecerá aquí.
          </p>
        ) : (
          <ul className={`${card} flex flex-col divide-y divide-zinc-200 py-0 dark:divide-zinc-800`}>
            {customers.map((customer) => (
              <li key={customer.membershipId}>
                <Link
                  href={`/panel/${merchantId}/clientes/${customer.membershipId}`}
                  className="flex items-center justify-between gap-3 py-3 hover:underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{customer.fullName}</span>
                    <span className={mutedText}>
                      desde <LocalDate iso={customer.joinedAt} />
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatPoints(customer.pointsBalance, membership.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

async function InviteCustomers({
  merchantId,
  joinCode,
  programActive,
}: {
  merchantId: string;
  joinCode: string;
  programActive: boolean;
}) {
  const url = `${getSiteUrl()}${joinPath(joinCode)}`;
  const qr = await qrSvgDataUrl(url);

  return (
    <section className={`${card} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Invita a tus clientes</h2>
        <p className={mutedText}>
          Comparte este enlace o pon el QR en tu mostrador. Quien lo abra podrá unirse a tu programa
          con su cuenta de Loyili.
        </p>
      </div>

      {!programActive && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Tu programa no está activo, así que por ahora nadie podrá unirse.{" "}
          <Link href={`/panel/${merchantId}/programa`} className="font-medium underline underline-offset-4">
            Ir a Programa
          </Link>
        </p>
      )}

      <CopyField value={url} label="Enlace para unirse" />

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
        {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, nothing to optimize */}
        <img src={qr} alt={`Código QR que abre ${url}`} width={160} height={160} className="rounded-lg bg-white" />
        <div className="flex flex-col gap-2">
          <p className={mutedText}>
            Código del comercio: <span className="font-mono font-semibold tracking-widest">{joinCode}</span>
          </p>
          <Link href={`/panel/${merchantId}/clientes/cartel`} className={secondaryButton}>
            Imprimir cartel
          </Link>
        </div>
      </div>
    </section>
  );
}
