/** "Activo" / "Pausado" badge of a loyalty program. */
export function ProgramStatus({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      Activo
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      Pausado
    </span>
  );
}
