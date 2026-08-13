import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import Providers from "@/components/Providers";
import PWARegister from "@/components/PWARegister";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND.title,
  description: BRAND.description,
  manifest: "/manifest.json",
  applicationName: BRAND.lockup,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND.product },
  icons: { icon: [{ url: "/icon-192.svg", type: "image/svg+xml" }], apple: "/icon-192.svg" },
};

export const viewport: Viewport = {
  themeColor: "#a98cf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f6f3fb] text-[#21172f] font-sans">
        <Providers>
          <PWARegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
