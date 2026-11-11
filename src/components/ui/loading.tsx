/** Lightweight placeholder shown while request-time content streams in (Suspense fallback). */
export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" className="py-6 text-center text-sm text-zinc-500">
      {label}
    </p>
  );
}
