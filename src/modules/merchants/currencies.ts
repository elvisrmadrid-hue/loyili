/**
 * Currencies a merchant can choose (ISO 4217). The database only checks the
 * 3-letter format, so adding one here does not need a migration.
 * Note for Module 3: CLP and PYG have no decimal minor units.
 */
const CURRENCY_NAMES = {
  ARS: "Peso argentino",
  BOB: "Boliviano",
  BRL: "Real brasileño",
  CLP: "Peso chileno",
  COP: "Peso colombiano",
  CRC: "Colón costarricense",
  DOP: "Peso dominicano",
  EUR: "Euro",
  GTQ: "Quetzal guatemalteco",
  HNL: "Lempira hondureño",
  MXN: "Peso mexicano",
  NIO: "Córdoba nicaragüense",
  PEN: "Sol peruano",
  PYG: "Guaraní paraguayo",
  USD: "Dólar estadounidense",
  UYU: "Peso uruguayo",
} as const;

export type CurrencyCode = keyof typeof CURRENCY_NAMES;

export const CURRENCY_CODES = Object.keys(CURRENCY_NAMES) as [CurrencyCode, ...CurrencyCode[]];

/** Options for a <select>, sorted by Spanish name. */
export const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({
  code,
  label: `${CURRENCY_NAMES[code]} (${code})`,
})).sort((a, b) => a.label.localeCompare(b.label, "es"));

/** "Peso colombiano (COP)"; unknown codes are shown as-is. */
export function currencyLabel(code: string): string {
  const name = CURRENCY_NAMES[code as CurrencyCode];
  return name ? `${name} (${code})` : code;
}
