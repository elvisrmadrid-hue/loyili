// Pure report logic (no server code), safe to import from client components.
// Covered by rules.test.ts.

/** Periods offered on the report page: last N days, or everything ("todo"). */
export const REPORT_PERIODS = [
  { value: "7", label: "7 días", days: 7 },
  { value: "30", label: "30 días", days: 30 },
  { value: "90", label: "90 días", days: 90 },
  { value: "todo", label: "Desde el inicio", days: null },
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const DEFAULT_PERIOD: ReportPeriod = REPORT_PERIODS[1];

/** The period chosen in the URL (?periodo=…); anything unknown falls back to 30 days. */
export function parseReportPeriod(value: unknown): ReportPeriod {
  return REPORT_PERIODS.find((period) => period.value === value) ?? DEFAULT_PERIOD;
}

/** Whole percentage of `part` over `total` (0 when there is no total). */
export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Average rounded down to whole minor units (0 when there is nothing to average). */
export function averageMinor(totalMinor: number, count: number): number {
  return count > 0 ? Math.floor(totalMinor / count) : 0;
}

/** Width of a proportional bar, in % of the largest value (at least a sliver when > 0). */
export function barWidth(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}
