import Link from "next/link";

type AppHeaderProps = {
  userName: string;
  /** Server Action that signs the user out. */
  signOutAction: () => Promise<void>;
};

/** Top bar of the private areas (wallet and merchant panel). */
export function AppHeader({ userName, signOutAction }: AppHeaderProps) {
  return (
    <header className="print:hidden flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Loyili
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">{userName}</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="shrink-0 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium dark:border-zinc-700"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
