import Link from "next/link";
import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered, mobile-first container for the sign-in / sign-up screens. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 sm:justify-center">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="text-center text-2xl font-semibold tracking-tight">
          Loyili
        </Link>
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
        </div>
        {children}
        {footer && <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</div>}
      </div>
    </main>
  );
}
