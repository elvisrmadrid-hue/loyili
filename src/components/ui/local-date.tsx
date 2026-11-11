"use client";

type LocalDateProps = {
  /** ISO date in UTC, as stored in the database. */
  iso: string;
  withTime?: boolean;
};

/**
 * Shows a UTC date in the viewer's own time zone (the conversion happens only in the UI).
 * The server may render it in another zone, hence suppressHydrationWarning.
 */
export function LocalDate({ iso, withTime = false }: LocalDateProps) {
  const text = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(iso));

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
