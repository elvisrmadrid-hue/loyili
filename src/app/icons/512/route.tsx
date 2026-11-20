import { renderIcon } from "../render-icon";

/** App icon 512×512 for the manifest (generated at build time). */
export function GET() {
  return renderIcon(512);
}
