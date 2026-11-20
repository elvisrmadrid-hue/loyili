import { ImageResponse } from "next/og";

/**
 * Provisional Loyili icon, drawn in code: a bold white "L" on black (the color of the app's
 * buttons). The letter is built from two bars, so it does not depend on any font. To use a
 * real logo, change only this function (or replace the icon routes with image files).
 *
 * `maskable`: Android may crop the icon to a circle or a rounded square, so the letter is
 * kept well inside the central "safe zone" and the background is full bleed.
 */
export function renderIcon(size: number, { maskable = false, rounded = false } = {}) {
  const height = Math.round(size * (maskable ? 0.4 : 0.54));
  const stroke = Math.round(height * 0.24);
  const width = Math.round(height * 0.68);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          borderRadius: rounded ? Math.round(size * 0.22) : 0,
        }}
      >
        <div style={{ width, height, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ width: stroke, height: height - stroke, background: "#ffffff" }} />
          <div style={{ width, height: stroke, background: "#ffffff" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
