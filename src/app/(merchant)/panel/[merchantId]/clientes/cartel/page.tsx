import type { Metadata } from "next";
import { Suspense } from "react";
import { getSiteUrl } from "@/lib/supabase/env";
import { qrSvgDataUrl } from "@/lib/qr";
import { joinPath } from "@/modules/customers";
import { describeRule, getLoyaltyProgram } from "@/modules/loyalty";
import { Loading } from "@/components/ui/loading";
import { PrintButton } from "@/components/ui/print-button";
import { mutedText } from "@/components/ui/styles";
import { loadMembership } from "../../load-membership";

export const metadata: Metadata = { title: "Cartel para imprimir" };

export default function PosterPage({ params }: PageProps<"/panel/[merchantId]/clientes/cartel">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ merchantId }) => (
        <Poster merchantId={merchantId} />
      ))}
    </Suspense>
  );
}

/** Printable poster with the join QR. The app header and menu are hidden when printing. */
async function Poster({ merchantId }: { merchantId: string }) {
  const membership = await loadMembership(merchantId, { ownerOnly: true });
  const program = await getLoyaltyProgram(merchantId);
  const url = `${getSiteUrl()}${joinPath(membership.joinCode)}`;
  const qr = await qrSvgDataUrl(url);

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <p className={mutedText}>
          Así se verá tu cartel. Pulsa «Imprimir»; en el cuadro de impresión también puedes elegir
          «Guardar como PDF».
        </p>
        {!program?.isActive && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Tu programa no está activo: quien escanee el cartel no podrá unirse hasta que lo actives.
          </p>
        )}
        <PrintButton label="Imprimir cartel" />
      </div>

      {/* Always black on white, so it prints well in light or dark mode. */}
      <article className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-zinc-300 bg-white p-8 text-center text-black print:max-w-none print:border-0 print:p-0">
        <p className="text-3xl font-bold">{membership.name}</p>
        <p className="text-xl">Únete a nuestro programa de puntos</p>
        {program && (
          <p className="text-lg">
            Gana <strong>{describeRule(program, membership.currency)}</strong> gastados
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, nothing to optimize */}
        <img src={qr} alt={`Código QR que abre ${url}`} width={280} height={280} />
        <p className="text-base">Escanea el código con la cámara de tu teléfono</p>
        <p className="break-all font-mono text-sm text-zinc-700">{url}</p>
        <p className="text-sm text-zinc-500">Loyili · tu tarjeta de puntos en el teléfono</p>
      </article>
    </>
  );
}
