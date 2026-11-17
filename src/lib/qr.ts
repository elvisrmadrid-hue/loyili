import QRCode from "qrcode";

/**
 * A QR code for `text` as an SVG data URL, ready for <img src>. Drawn on the server, so
 * the browser downloads no QR library. Using <img> (instead of inserting the SVG markup)
 * also lets people save or print the image like any other picture.
 */
export async function qrSvgDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
