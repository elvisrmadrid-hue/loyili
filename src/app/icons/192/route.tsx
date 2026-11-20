import { renderIcon } from "../render-icon";

/** App icon 192×192 for the manifest (generated at build time). */
export function GET() {
  return renderIcon(192);
}
