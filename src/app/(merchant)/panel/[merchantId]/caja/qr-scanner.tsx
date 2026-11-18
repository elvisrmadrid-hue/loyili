"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeCustomerCode } from "@/modules/identification/rules";
import { mutedText } from "@/components/ui/styles";

/** How often a camera frame is analyzed (ms). Enough for a QR held in front of the camera. */
const SCAN_EVERY_MS = 150;
/** Frames are scaled down to this width before looking for a QR (faster, same result). */
const MAX_WIDTH = 640;

type QrScannerProps = {
  /** Called once with the normalized customer code. The camera is already stopped. */
  onCode: (code: string) => void;
};

/**
 * Camera preview that looks for a customer QR. The QR reader (jsQR) is downloaded only when
 * this component appears. Browsers allow the camera only on HTTPS or localhost.
 */
export function QrScanner({ onCode }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem(
          "Este navegador no permite usar la cámara aquí (solo funciona con HTTPS o en localhost). Escribe el código.",
        );
        return;
      }

      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        ]);
        stream = media;
        if (stopped) return stop();

        const video = videoRef.current!;
        video.srcObject = media;
        await video.play();

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        let lastScan = 0;
        let lastHint = "";

        const scan = (now: number) => {
          if (stopped) return;
          frame = requestAnimationFrame(scan);
          if (now - lastScan < SCAN_EVERY_MS || video.readyState < video.HAVE_ENOUGH_DATA) return;
          lastScan = now;

          const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (!result?.data) return;

          const code = normalizeCustomerCode(result.data);
          if (code) {
            stop();
            onCodeRef.current(code);
          } else if (result.data !== lastHint) {
            lastHint = result.data;
            setHint("Ese QR no es un código de cliente de Loyili. Pide al cliente que abra «Mi código» en su billetera.");
          }
        };
        frame = requestAnimationFrame(scan);
      } catch (error) {
        stop();
        const name = error instanceof DOMException ? error.name : "";
        setProblem(
          name === "NotAllowedError"
            ? "No hay permiso para usar la cámara. Permítelo en el navegador (icono junto a la dirección) o escribe el código."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No se encontró ninguna cámara. Escribe el código."
              : "No se pudo abrir la cámara. Escribe el código.",
        );
      }
    }

    void start();
    return stop;
  }, []);

  if (problem) return <p className={mutedText}>{problem}</p>;

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        muted
        playsInline
        className="aspect-video w-full rounded-lg bg-black object-cover"
        aria-label="Vista de la cámara"
      />
      <p className={mutedText}>{hint ?? "Apunta la cámara al QR de la billetera del cliente."}</p>
    </div>
  );
}
