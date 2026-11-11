import Link from "next/link";
import { primaryButton } from "@/components/ui/styles";

/** 404 page: unknown URLs and resources the user may not see (e.g. another merchant). */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        La página que buscas no existe o no tienes acceso a ella.
      </p>
      <Link href="/" className={primaryButton}>
        Ir al inicio
      </Link>
    </main>
  );
}
