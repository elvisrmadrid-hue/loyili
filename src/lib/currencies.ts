/**
 * Currencies a merchant can choose (ISO 4217). The database only checks the
 * 3-letter format, so adding one here does not need a migration.
 *
 * Pure data and functions (no server code), so client components can use it too.
 */
type CurrencyInfo = {
  /** Spanish name shown in the UI. */
  name: string;
  /** ISO 4217 minor-unit digits: how many "cents" a unit has (10^decimals). */
  decimals: number;
  /** Locale used to format amounts the way people in that country write them. */
  locale: string;
};

const CURRENCIES = {
  ARS: { name: "Peso argentino", decimals: 2, locale: "es-AR" },
  BOB: { name: "Boliviano", decimals: 2, locale: "es-BO" },
  BRL: { name: "Real brasileño", decimals: 2, locale: "pt-BR" },
  CLP: { name: "Peso chileno", decimals: 0, locale: "es-CL" },
  COP: { name: "Peso colombiano", decimals: 2, locale: "es-CO" },
  CRC: { name: "Colón costarricense", decimals: 2, locale: "es-CR" },
  DOP: { name: "Peso dominicano", decimals: 2, locale: "es-DO" },
  EUR: { name: "Euro", decimals: 2, locale: "es-ES" },
  GTQ: { name: "Quetzal guatemalteco", decimals: 2, locale: "es-GT" },
  HNL: { name: "Lempira hondureño", decimals: 2, locale: "es-HN" },
  MXN: { name: "Peso mexicano", decimals: 2, locale: "es-MX" },
  NIO: { name: "Córdoba nicaragüense", decimals: 2, locale: "es-NI" },
  PEN: { name: "Sol peruano", decimals: 2, locale: "es-PE" },
  PYG: { name: "Guaraní paraguayo", decimals: 0, locale: "es-PY" },
  USD: { name: "Dólar estadounidense", decimals: 2, locale: "en-US" },
  UYU: { name: "Peso uruguayo", decimals: 2, locale: "es-UY" },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]];

function infoOf(code: string): CurrencyInfo | undefined {
  return (CURRENCIES as Record<string, CurrencyInfo>)[code];
}

/** Options for a <select>, sorted by Spanish name. */
export const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({
  code,
  label: `${CURRENCIES[code].name} (${code})`,
})).sort((a, b) => a.label.localeCompare(b.label, "es"));

/** "Peso colombiano (COP)"; unknown codes are shown as-is. */
export function currencyLabel(code: string): string {
  const info = infoOf(code);
  return info ? `${info.name} (${code})` : code;
}

/** Minor-unit digits of a currency (2 for unknown codes, the most common case). */
export function currencyDecimals(code: string): number {
  return infoOf(code)?.decimals ?? 2;
}

/** Locale whose number format matches the currency's country ("es" for unknown codes). */
export function currencyLocale(code: string): string {
  return infoOf(code)?.locale ?? "es";
}

/** Formats a whole amount of currency units, without decimals: "$ 1.000", "S/ 1,000". */
export function formatWholeAmount(units: number, code: string): string {
  return new Intl.NumberFormat(currencyLocale(code), {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(units);
}

/** Formats an amount in minor units, showing cents only when there are any: "$ 25.500", "$12.50". */
export function formatMoney(amountMinor: number, code: string): string {
  const decimals = currencyDecimals(code);
  return new Intl.NumberFormat(currencyLocale(code), {
    style: "currency",
    currency: code,
    minimumFractionDigits: amountMinor % 10 ** decimals === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(amountMinor / 10 ** decimals);
}
