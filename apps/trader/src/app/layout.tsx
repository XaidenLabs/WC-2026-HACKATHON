import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TxAgent — verifiable AI sports trading",
  description: "Describe your edge, backtest on real World Cup data, and let a verifiable on-chain AI trade it.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TxAgent" },
  icons: { icon: [{ url: "/icon-192.svg", type: "image/svg+xml" }], apple: "/icon-192.svg" },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-gray-300 font-sans selection:bg-emerald-500/30">
        <Providers>
          <PWARegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
