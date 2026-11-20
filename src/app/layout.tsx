import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineBanner } from "@/components/offline-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Loyili",
    template: "%s · Loyili",
  },
  description:
    "Fidelización digital para negocios: puntos y recompensas sin tarjetas físicas.",
  applicationName: "Loyili",
  // Installed on an iPhone home screen: open without Safari's bars, named "Loyili".
  appleWebApp: { capable: true, title: "Loyili", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

/** Phone status bar color (light and dark) and use of the whole screen, notch included. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
