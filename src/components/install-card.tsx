"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { installPlatform, type InstallPlatform } from "@/lib/device";
import { card, mutedText, primaryButton } from "@/components/ui/styles";

const DISMISSED_KEY = "loyili:install-card-dismissed";

/** Chrome/Edge event that lets a page show its own "Install" button (not in Safari/Firefox). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// What the card needs to know about this device. Read once in the browser; on the server
// (and while hydrating) the card stays hidden, so nothing flickers.
type DeviceState = { hidden: boolean; platform: InstallPlatform };
const HIDDEN: DeviceState = { hidden: true, platform: "other" };
let cached: DeviceState | null = null;
const listeners = new Set<() => void>();

function readDevice(): DeviceState {
  if (cached) return cached;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private mode or storage blocked: just show the card.
  }
  cached = {
    hidden: standalone || dismissed,
    platform: installPlatform(navigator.userAgent, navigator.maxTouchPoints),
  };
  return cached;
}

function hideForGood() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {}
  cached = { ...readDevice(), hidden: true };
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * "Install Loyili on your phone": an Install button where the browser allows it (Chrome,
 * Edge, Android), the steps on iPhone. Hidden inside the installed app and once dismissed.
 */
export function InstallCard() {
  const device = useSyncExternalStore(subscribe, readDevice, () => HIDDEN);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // Keep the browser's mini-bar; we show our own button.
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => hideForGood();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (device.hidden) return null;
  // Desktop browsers without an install option (Firefox, Safari on Mac): nothing useful to say.
  if (!prompt && device.platform === "other") return null;

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">Instala Loyili en tu teléfono</h2>
        <button
          type="button"
          onClick={hideForGood}
          className="-m-2 shrink-0 p-2 text-sm underline underline-offset-4"
          aria-label="Ocultar este aviso"
        >
          Ahora no
        </button>
      </div>
      <p className={mutedText}>Abre tu billetera con un toque, como cualquier app, sin buscarla en el navegador.</p>
      {prompt ? (
        <button
          type="button"
          className={`${primaryButton} self-start`}
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            setPrompt(null); // The browser allows asking only once per event.
            if (outcome === "accepted") hideForGood();
          }}
        >
          Instalar
        </button>
      ) : device.platform === "ios" ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Abre esta página en <strong>Safari</strong>.</li>
          <li>
            Toca <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba).
          </li>
          <li>
            Elige <strong>Añadir a pantalla de inicio</strong> y confirma.
          </li>
        </ol>
      ) : (
        <p className="text-sm">
          Abre el menú del navegador (<strong>⋮</strong>) y elige <strong>Instalar aplicación</strong> o{" "}
          <strong>Añadir a pantalla de inicio</strong>.
        </p>
      )}
    </section>
  );
}
