"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MerchantNavProps = {
  merchantId: string;
  isOwner: boolean;
};

/** Section tabs of a merchant; highlights the current one. */
export function MerchantNav({ merchantId, isOwner }: MerchantNavProps) {
  const pathname = usePathname();
  const base = `/panel/${merchantId}`;

  const items = [
    { href: base, label: "Inicio" },
    { href: `${base}/sucursales`, label: "Sucursales" },
    ...(isOwner
      ? [
          { href: `${base}/personal`, label: "Personal" },
          { href: `${base}/ajustes`, label: "Ajustes" },
        ]
      : []),
    { href: "/panel", label: "Mis comercios" },
  ];

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-zinc-600 hover:text-foreground dark:text-zinc-400"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
