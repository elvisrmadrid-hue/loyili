/** A freshly issued customer code, ready for the wallet's "Mi código" screen. */
export type IssuedCode = {
  /** "K7P2-QX4M": shown under the QR and encoded in it. */
  display: string;
  /** The QR as an SVG data URL. */
  qr: string;
  /** Seconds it is valid from now (the wallet counts down with its own clock). */
  validSeconds: number;
};
