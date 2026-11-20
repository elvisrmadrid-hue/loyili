"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Warns when the device loses its connection, so nobody trusts a balance or a code that
 * cannot be refreshed. Disappears by itself when the connection comes back.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // On the server (and while hydrating) assume online.
  );
  if (online) return null;

  return (
    <p
      role="status"
      className="print:hidden fixed inset-x-0 bottom-0 z-50 bg-amber-100 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-sm font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-50"
    >
      Sin conexión. Tus datos se actualizarán cuando vuelva internet.
    </p>
  );
}
