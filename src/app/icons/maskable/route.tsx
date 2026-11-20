import { renderIcon } from "../render-icon";

/** "Maskable" 512×512 icon: Android may crop it to its own shape (circle, rounded square…). */
export function GET() {
  return renderIcon(512, { maskable: true });
}
